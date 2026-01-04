"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, MeshDistortMaterial } from "@react-three/drei";
import { useRef } from "react";
import { motion } from "framer-motion";
import { Mesh } from "three";
import { useAuth } from "@/api/auth";
import Link from "next/link";

function AnimatedSphere() {
  const sphereRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (sphereRef.current) {
      sphereRef.current.rotation.x = t * 0.2;
      sphereRef.current.rotation.y = t * 0.3;
    }
  });

  return (
    <Sphere visible args={[1, 100, 200]} scale={2.5} ref={sphereRef}>
      <MeshDistortMaterial
        color="#4f46e5"
        attach="material"
        distort={0.5}
        speed={2}
        roughness={0.2}
      />
    </Sphere>
  );
}

export function Hero() {
  const {isAuthenticated} = useAuth()

  return (
    <div className="relative h-screen w-full bg-gray-900 overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <AnimatedSphere />
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pointer-events-none">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-bold text-white mb-6 pointer-events-auto"
        >
          Connect Beyond Limits
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl text-gray-300 mb-8 max-w-2xl pointer-events-auto"
        >
          Experience the next generation of communication. Real-time chat, crystal clear calls, and a community that defies gravity.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="pointer-events-auto"
        >
          {isAuthenticated ? (
             <Link
              prefetch
              href="/chat"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/50"
           >
             Go to Chat
           </Link>
          ) : (
            <Link
            prefetch
            href="/auth"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/50"
          >
            Get Started
          </Link>
          )}
        </motion.div>
      </div>
    </div>
  );
}
