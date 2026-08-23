import React, { useEffect, useRef } from "react";

export default function ParticleBackground({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "high-performance" });
    if (!gl) return;

    // Compile Shaders
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      varying vec3 vColor;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      void main() {
        vColor = aColor;
        vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
        gl_Position = uProjectionMatrix * mvPosition;
        // Increased size multiplier to match ThreeJS size=0.022 on high-res displays
        gl_PointSize = 35.0 / -mvPosition.z; 
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        // Brighter center, softer edge
        float alpha = 1.0 * smoothstep(0.5, 0.1, dist);
        gl_FragColor = vec4(vColor * alpha, alpha);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vertShader = compileShader(gl.VERTEX_SHADER, vsSource);
    const fragShader = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program || !vertShader || !fragShader) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Adaptive particle count: 1500 for Desktop, 600 for Mobile (same visual density, 60% less mobile GPU load)
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const count = isMobile ? 600 : 1500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3.0 + Math.random() * 6.0;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.85;

      // 75% Gold, 25% Champagne/White
      const isGold = Math.random() > 0.25;
      colors[i * 3] = isGold ? 0.79 : 0.90;
      colors[i * 3 + 1] = isGold ? 0.66 : 0.85;
      colors[i * 3 + 2] = isGold ? 0.30 : 0.77;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    const colorLoc = gl.getAttribLocation(program, "aColor");
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

    const uModelViewMatrix = gl.getUniformLocation(program, "uModelViewMatrix");
    const uProjectionMatrix = gl.getUniformLocation(program, "uProjectionMatrix");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); 

    const createPerspective = (fov: number, aspect: number, near: number, far: number) => {
      const f = 1.0 / Math.tan(fov * Math.PI / 360.0);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
      ]);
    };

    let projMatrix = createPerspective(60, canvas.width / canvas.height, 0.1, 100);

    const resize = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      // Cap DPR to 1.5 to avoid rendering massive 4K/6K surfaces on high-density mobile screens
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
      const targetW = Math.floor(displayWidth * dpr);
      const targetH = Math.floor(displayHeight * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        gl.viewport(0, 0, canvas.width, canvas.height);
        projMatrix = createPerspective(60, canvas.width / canvas.height, 0.1, 100);
      }
    };
    window.addEventListener('resize', resize);
    resize();

    let reqId: number;
    let startTime = performance.now();
    let isVisible = true;

    const render = (time: number) => {
      if (!isVisible) return; // Pause rendering if out of view
      
      const elapsed = (time - startTime) * 0.001;
      gl.clear(gl.COLOR_BUFFER_BIT);

      const cameraZ = 6.0;
      const rotY = elapsed * 0.035 + (mouseRef.current?.x || 0) * 0.09;
      const rotX = Math.sin(elapsed * 0.02) * 0.05 + (mouseRef.current?.y || 0) * 0.07;

      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      const mv = new Float32Array([
        cosY, sinX * sinY, cosX * sinY, 0,
        0, cosX, -sinX, 0,
        -sinY, sinX * cosY, cosX * cosY, 0,
        0, 0, -cameraZ, 1
      ]);

      gl.uniformMatrix4fv(uProjectionMatrix, false, projMatrix);
      gl.uniformMatrix4fv(uModelViewMatrix, false, mv);

      gl.drawArrays(gl.POINTS, 0, count);
      reqId = requestAnimationFrame(render);
    };

    // Use Intersection Observer to pause/resume
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (!isVisible) {
          isVisible = true;
          // Adjust startTime so it doesn't jump
          startTime = performance.now() - (performance.now() - startTime); 
          reqId = requestAnimationFrame(render);
        }
      } else {
        isVisible = false;
        cancelAnimationFrame(reqId);
      }
    }, { threshold: 0 });
    
    observer.observe(canvas);
    reqId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(reqId);
      observer.disconnect();
      gl.deleteBuffer(posBuffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="w-full h-full pointer-events-none animate-in fade-in duration-1000">
      <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
    </div>
  );
}
