"use client";

import { useEffect, useRef, useState } from "react";
import { getActiveAudio } from "@/lib/voice";

export function VoiceVisualizer({
  isListening,
  isSpeaking,
}: {
  isListening: boolean;
  isSpeaking: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectedAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Setup/teardown Web Audio API
  useEffect(() => {
    let active = true;

    async function init() {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 128;
      }
      const analyser = analyserRef.current;

      try {
        if (isListening) {
          // Unhook previous
          if (sourceRef.current) sourceRef.current.disconnect();
          connectedAudioElementRef.current = null;

          if (!streamRef.current) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!active) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            streamRef.current = stream;
          }
          const source = ctx.createMediaStreamSource(streamRef.current);
          source.connect(analyser);
          sourceRef.current = source;
          // Do NOT connect mic to destination to avoid feedback
        } else if (isSpeaking) {
          const audioEl = getActiveAudio();
          if (audioEl && audioEl !== connectedAudioElementRef.current) {
            if (sourceRef.current) sourceRef.current.disconnect();
            
            // Only create MediaElementSource once per audio element to avoid InvalidStateError
            const source = ctx.createMediaElementSource(audioEl);
            source.connect(analyser);
            analyser.connect(ctx.destination);
            sourceRef.current = source;
            connectedAudioElementRef.current = audioEl;
          }
        } else {
          // Idle
          if (sourceRef.current) sourceRef.current.disconnect();
          sourceRef.current = null;
          connectedAudioElementRef.current = null;
        }
      } catch (err) {
        console.warn("[VoiceVisualizer] Audio routing failed, falling back to idle animation", err);
      }
    }

    init();

    return () => {
      active = false;
      // We don't close the audio context here to allow reuse, just stop streams
      if (streamRef.current && !isListening) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isListening, isSpeaking]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    const dataArray = new Uint8Array(64); // Half of fftSize 128

    function draw() {
      if (!canvas || !ctx) return;
      reqRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      let volume = 0;
      if (analyserRef.current && (isListening || isSpeaking)) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        volume = sum / dataArray.length; // 0 to 255
      }

      // Base radius
      const baseRadius = 80;
      const maxRadius = 140;

      // Map volume to radius boost
      const normalizedVol = Math.min(volume / 128, 1);
      const targetRadius = baseRadius + normalizedVol * (maxRadius - baseRadius);

      time += 0.05;

      // Draw the wave circle
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
        // Add some breathing/noise based on time, even if idle
        const noise = isListening || isSpeaking 
          ? (Math.sin(angle * 4 + time) * 5 + Math.cos(angle * 3 - time) * 5) * normalizedVol
          : Math.sin(angle * 2 + time * 0.5) * 3; // slow breath when idle

        const r = (isListening || isSpeaking ? targetRadius : baseRadius) + noise;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      ctx.strokeStyle = "#F5A524";
      ctx.lineWidth = 3;
      // Add a glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#F5A524";
      ctx.stroke();

      // Inner faint fill
      ctx.fillStyle = "rgba(245, 165, 36, 0.1)";
      ctx.fill();

      // Reset shadow for next frame
      ctx.shadowBlur = 0;
    }

    reqRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(reqRef.current);
  }, [isListening, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className="absolute inset-0 m-auto pointer-events-none"
    />
  );
}
