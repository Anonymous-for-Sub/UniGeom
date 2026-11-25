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

const vertex = `
attribute vec3 p, n;
attribute float occlusion;
uniform mat4 camera, model;
uniform vec3 color;
varying vec3 lit;
void main() {
  vec3 normal = normalize(mat3(model) * n);
  float key = max(0.0, dot(normal, vec3(-.370, -.566, .736)));
  float fill = max(0.0, dot(normal, vec3(.702, .500, .506)));
  float rim = pow(max(0.0, dot(normal, vec3(.769, .513, .381))), 6.0);
  vec3 world = (model * vec4(p, 1.0)).xyz;
  float lab = 1.0 - smoothstep(-.3, .3, world.x);
  float ambient = mix(.40,.72,lab);
  lit = (color * (ambient + mix(.50,.35,lab) * key + .10 * fill) + vec3(.042,.044,.066) * rim) * occlusion;
  gl_Position = camera * model * vec4(p, 1.0);
}`;
const fragment = `precision mediump float; varying vec3 lit; uniform float opacity;
void main() { gl_FragColor = vec4(lit, opacity); }`;

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
      for (const { mesh, transform, rgb, opacity = 1 } of items) {
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
      for (const { mesh, transform, rgb, opacity = 1 } of items) {
        const m = transform.elements;
        const { positions, normals, indices } = mesh;
        const count = positions.length / 3;
        if (count * 5 > projected.length)
          projected = new Float32Array(count * 5);
        for (let i = 0; i < count; i++) {
          const a = i * 3,
            b = i * 5;
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
          const a = indices[k] * 5,
            b = indices[k + 1] * 5,
            c = indices[k + 2] * 5;
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
              const light = la + u * lb + v * lc,
                rim = ra + u * rb + v * rc;
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
