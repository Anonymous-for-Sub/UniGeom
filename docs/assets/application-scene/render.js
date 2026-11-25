// The same indexed triangles, camera and light model are used by both backends.
function decode(encoded, Type) {
  return new Type(
    Uint8Array.from(atob(encoded), (ch) => ch.charCodeAt(0)).buffer,
  );
}

export function unpackMesh(source) {
  const positions = Float32Array.from(
    decode(source.p, Int16Array),
    (v) => v / 4096,
  );
  const normals = Float32Array.from(
    decode(source.n, Int8Array),
    (v) => v / 127,
  );
  const shade = source.s ? decode(source.s, Uint8Array) : null;
  return { positions, normals, shade, indices: decode(source.i, Uint16Array) };
}

// Seamless, deterministic material tiles; shared by WebGL and the CPU fallback.
// World-space mapping keeps grain attached to surfaces during camera movement.
const SIZE = 128;
const surfaceCache = new Map();
function surfaceTexture(name = "") {
  let kind = "",
    scale = 1;
  if (name.includes("concrete")) {
    kind = "concrete";
    scale = 1.4;
  } else if (name.includes("epoxy")) {
    kind = "epoxy";
    scale = 2.4;
  } else if (name.includes("white cabinet")) {
    kind = "laminate";
    scale = 2.5;
  } else if (name.includes("aluminium") || name.includes("steel")) {
    kind = "metal";
    scale = 4;
  } else if (name.includes("cardboard")) {
    kind = "paper";
    scale = 3;
  } else if (name.includes("wood")) {
    kind = "wood";
    scale = 2;
  } else if (name.includes("plaster")) {
    kind = "plaster";
    scale = 2;
  }
  if (surfaceCache.has(kind)) return surfaceCache.get(kind);
  const data = new Uint8Array(SIZE * SIZE);
  let seed = 5719;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const grids = [4, 16, 64].map((n) => ({
    n,
    a: Float32Array.from({ length: n * n }, () => rand() * 2 - 1),
  }));
  const noise = (x, y, g) => {
    const fx = (x * g.n) / SIZE,
      fy = (y * g.n) / SIZE,
      ix = Math.floor(fx),
      iy = Math.floor(fy);
    let u = fx - ix,
      v = fy - iy;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    const at = (a, b) => g.a[(b % g.n) * g.n + (a % g.n)];
    return (
      (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) +
      (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v
    );
  };
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const broad = noise(x, y, grids[0]),
        mid = noise(x, y, grids[1]),
        fine = noise(x, y, grids[2]),
        grit = rand() * 2 - 1;
      let v = 1;
      if (kind === "concrete")
        v += 0.085 * broad + 0.045 * mid + 0.045 * fine + 0.027 * grit;
      if (kind === "epoxy") v += 0.026 * broad + 0.022 * fine + 0.018 * grit;
      if (kind === "laminate")
        v +=
          0.018 * broad +
          0.018 * fine +
          0.012 * Math.sin((y * Math.PI * 90) / SIZE + mid * 0.6);
      if (kind === "metal")
        v +=
          0.013 * mid +
          0.026 * Math.sin((y * Math.PI * 110) / SIZE + fine * 0.45) +
          0.014 * grit;
      if (kind === "paper")
        v +=
          0.04 * mid +
          0.045 * fine +
          0.018 * Math.sin((x * Math.PI * 62) / SIZE);
      if (kind === "wood")
        v +=
          0.045 * broad +
          0.055 * Math.sin((y * Math.PI * 20) / SIZE + broad * 2.4) +
          0.018 * grit;
      if (kind === "plaster") v += 0.025 * broad + 0.028 * fine + 0.018 * grit;
      data[y * SIZE + x] = Math.round(v * 128);
    }
  const result = { data, scale, active: !!kind };
  surfaceCache.set(kind, result);
  return result;
}

const vertex = `
attribute vec3 p, n;
attribute float occlusion;
uniform mat4 camera, model;
uniform vec3 color;
varying vec3 lit;
varying vec2 surfaceUV;
void main() {
  vec3 normal = normalize(mat3(model) * n);
  float key = max(0.0, dot(normal, vec3(-.370, -.566, .736)));
  float fill = max(0.0, dot(normal, vec3(.702, .500, .506)));
  float rim = pow(max(0.0, dot(normal, vec3(.769, .513, .381))), 6.0);
  vec3 world = (model * vec4(p, 1.0)).xyz;
  vec3 an = abs(normal);
  surfaceUV = an.z >= an.x && an.z >= an.y ? world.xy : (an.x >= an.y ? world.yz : world.xz);
  float lab = 1.0 - smoothstep(-.3, .3, world.x);
  float ambient = mix(.40,.72,lab);
  lit = (color * (ambient + mix(.50,.35,lab) * key + .10 * fill) + vec3(.042,.044,.066) * rim) * occlusion;
  gl_Position = camera * model * vec4(p, 1.0);
}`;
const fragment = `precision mediump float;
varying vec3 lit; varying vec2 surfaceUV;
uniform float opacity, surfaceScale;
uniform sampler2D grain;
void main() {
  float textureShade = texture2D(grain, surfaceUV * surfaceScale).r * (255.0 / 128.0);
  gl_FragColor = vec4(lit * textureShade, opacity);
}`;

function glRenderer(gl) {
  const shaders = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map((type, i) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, [vertex, fragment][i]);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(shader));
    return shader;
  });
  const program = gl.createProgram();
  shaders.forEach((shader) => gl.attachShader(program, shader));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  shaders.forEach((shader) => gl.deleteShader(shader));
  const p = gl.getAttribLocation(program, "p"),
    n = gl.getAttribLocation(program, "n");
  const ao = gl.getAttribLocation(program, "occlusion");
  const camera = gl.getUniformLocation(program, "camera");
  const model = gl.getUniformLocation(program, "model"),
    color = gl.getUniformLocation(program, "color");
  const alpha = gl.getUniformLocation(program, "opacity");
  const surfaceScale = gl.getUniformLocation(program, "surfaceScale");
  gl.uniform1i(gl.getUniformLocation(program, "grain"), 0);
  const textures = new Map();
  function bindSurface(name) {
    const t = surfaceTexture(name);
    if (!textures.has(t)) {
      const id = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, id);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        SIZE,
        SIZE,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        t.data,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      textures.set(t, id);
    }
    gl.bindTexture(gl.TEXTURE_2D, textures.get(t));
    gl.uniform1f(surfaceScale, t.scale);
  }
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  gl.enableVertexAttribArray(p);
  gl.enableVertexAttribArray(n);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const meshes = new Map();
  const buffer = (array, target) => {
    const id = gl.createBuffer();
    gl.bindBuffer(target, id);
    gl.bufferData(target, array, gl.STATIC_DRAW);
    return id;
  };
  return {
    name: "webgl",
    pixelRatio: () => Math.min(2, devicePixelRatio || 1),
    draw(view, items) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(camera, false, view.elements);
      for (const { mesh, transform, rgb, opacity = 1, surface } of items) {
        if (!meshes.has(mesh))
          meshes.set(mesh, [
            buffer(mesh.positions, gl.ARRAY_BUFFER),
            buffer(mesh.normals, gl.ARRAY_BUFFER),
            buffer(mesh.indices, gl.ELEMENT_ARRAY_BUFFER),
            mesh.shade ? buffer(mesh.shade, gl.ARRAY_BUFFER) : null,
          ]);
        const [pos, norm, indices, shade] = meshes.get(mesh);
        if (shade) {
          gl.enableVertexAttribArray(ao);
          gl.bindBuffer(gl.ARRAY_BUFFER, shade);
          gl.vertexAttribPointer(ao, 1, gl.UNSIGNED_BYTE, true, 0, 0);
        } else {
          gl.disableVertexAttribArray(ao);
          gl.vertexAttrib1f(ao, 1);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, pos);
        gl.vertexAttribPointer(p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, norm);
        gl.vertexAttribPointer(n, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.uniformMatrix4fv(model, false, transform.elements);
        gl.uniform3fv(color, rgb);
        gl.uniform1f(alpha, opacity);
        bindSurface(surface);
        gl.drawElements(
          gl.TRIANGLES,
          mesh.indices.length,
          gl.UNSIGNED_SHORT,
          0,
        );
      }
    },
    dispose() {
      for (const buffers of meshes.values())
        buffers.forEach((id) => gl.deleteBuffer(id));
      for (const id of textures.values()) gl.deleteTexture(id);
      gl.deleteProgram(program);
    },
  };
}

function canvasRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  let image,
    depth,
    pixels,
    projected = new Float32Array(0);
  return {
    name: "canvas2d",
    pixelRatio: (width) => Math.min(1.25, 1000 / width),
    draw(view, items) {
      const { width, height } = canvas;
      if (!image || image.width !== width || image.height !== height) {
        image = ctx.createImageData(width, height);
        depth = new Float32Array(width * height);
        pixels = new Uint32Array(image.data.buffer);
      }
      depth.fill(Infinity);
      pixels.fill(0);
      const vp = view.elements;
      for (const { mesh, transform, rgb, opacity = 1, surface } of items) {
        const m = transform.elements;
        const tile = surfaceTexture(surface);
        const { positions, normals, indices } = mesh;
        const count = positions.length / 3;
        if (count * 7 > projected.length)
          projected = new Float32Array(count * 7);
        for (let i = 0; i < count; i++) {
          const a = i * 3,
            b = i * 7;
          const x = positions[a],
            y = positions[a + 1],
            z = positions[a + 2];
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12],
            wy = m[1] * x + m[5] * y + m[9] * z + m[13],
            wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          projected[b] =
            (1 + vp[0] * wx + vp[4] * wy + vp[8] * wz + vp[12]) * width * 0.5;
          projected[b + 1] =
            (1 - vp[1] * wx - vp[5] * wy - vp[9] * wz - vp[13]) * height * 0.5;
          projected[b + 2] = vp[2] * wx + vp[6] * wy + vp[10] * wz + vp[14];
          const u = normals[a],
            v = normals[a + 1],
            w = normals[a + 2];
          const nx = m[0] * u + m[4] * v + m[8] * w,
            ny = m[1] * u + m[5] * v + m[9] * w,
            nz = m[2] * u + m[6] * v + m[10] * w;
          const axn = Math.abs(nx),
            ayn = Math.abs(ny),
            azn = Math.abs(nz);
          projected[b + 5] =
            (azn >= axn && azn >= ayn ? wx : axn >= ayn ? wy : wx) *
            tile.scale *
            SIZE;
          projected[b + 6] =
            (azn >= axn && azn >= ayn ? wy : wz) * tile.scale * SIZE;
          const shade = mesh.shade ? mesh.shade[i] / 255 : 1;
          const edge = Math.max(0, Math.min(1, (wx + 0.3) / 0.6));
          const lab = 1 - edge * edge * (3 - 2 * edge);
          projected[b + 3] =
            shade *
            (0.4 +
              0.32 * lab +
              (0.5 - 0.15 * lab) *
                Math.max(0, -0.37 * nx - 0.566 * ny + 0.736 * nz) +
              0.1 * Math.max(0, 0.702 * nx + 0.5 * ny + 0.506 * nz));
          projected[b + 4] =
            shade * Math.max(0, 0.769 * nx + 0.513 * ny + 0.381 * nz) ** 6;
        }
        for (let k = 0; k < indices.length; k += 3) {
          const a = indices[k] * 7,
            b = indices[k + 1] * 7,
            c = indices[k + 2] * 7;
          const ax = projected[a],
            ay = projected[a + 1],
            bx = projected[b],
            by = projected[b + 1],
            cx = projected[c],
            cy = projected[c + 1];
          const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5)),
            x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
          const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5)),
            y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
          if (x0 > x1 || y0 > y1) continue;
          const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (Math.abs(area) < 0.015) continue;
          const ux = (cy - ay) / area,
            uy = (ax - cx) / area,
            vx = (ay - by) / area,
            vy = (bx - ax) / area;
          const az = projected[a + 2],
            bz = projected[b + 2] - az,
            cz = projected[c + 2] - az;
          const la = projected[a + 3],
            lb = projected[b + 3] - la,
            lc = projected[c + 3] - la;
          const ra = projected[a + 4],
            rb = projected[b + 4] - ra,
            rc = projected[c + 4] - ra;
          const tx = projected[a + 5],
            ty = projected[a + 6],
            txb = projected[b + 5] - tx,
            txc = projected[c + 5] - tx,
            tyb = projected[b + 6] - ty,
            tyc = projected[c + 6] - ty;
          for (let py = y0; py <= y1; py++) {
            const dy = py + 0.5 - ay,
              dx = x0 + 0.5 - ax;
            let u = ux * dx + uy * dy,
              v = vx * dx + vy * dy;
            for (let px = x0; px <= x1; px++, u += ux, v += vx) {
              if (u < 0 || v < 0 || u + v > 1) continue;
              const z = az + u * bz + v * cz,
                j = py * width + px;
              if (z >= depth[j]) continue;
              depth[j] = z;
              const grain = tile.active
                ? tile.data[
                    ((Math.floor(ty + u * tyb + v * tyc) & 127) << 7) +
                      (Math.floor(tx + u * txb + v * txc) & 127)
                  ] / 128
                : 1;
              const light = (la + u * lb + v * lc) * grain,
                rim = (ra + u * rb + v * rc) * grain;
              let red = Math.min(
                255,
                Math.round(255 * (rgb[0] * light + 0.042 * rim)),
              );
              let green = Math.min(
                255,
                Math.round(255 * (rgb[1] * light + 0.044 * rim)),
              );
              let blue = Math.min(
                255,
                Math.round(255 * (rgb[2] * light + 0.066 * rim)),
              );
              if (opacity < 1) {
                const below = pixels[j],
                  inv = 1 - opacity;
                red = Math.round(red * opacity + (below & 255) * inv);
                green = Math.round(
                  green * opacity + ((below >>> 8) & 255) * inv,
                );
                blue = Math.round(
                  blue * opacity + ((below >>> 16) & 255) * inv,
                );
              }
              pixels[j] = 0xff000000 | (blue << 16) | (green << 8) | red;
            }
          }
        }
      }
      ctx.putImageData(image, 0, 0);
    },
    dispose() {},
  };
}

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  return gl ? glRenderer(gl) : canvasRenderer(canvas);
}
