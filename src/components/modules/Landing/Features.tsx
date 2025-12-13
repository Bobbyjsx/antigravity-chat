"use client";

import { motion } from "framer-motion";
import { MessageSquare, Shield, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: <MessageSquare className="w-8 h-8 text-blue-400" />,
    title: "Real-time Chat",
    description: "Instant messaging with zero latency. Experience conversations as they happen.",
  },
  {
    icon: <Shield className="w-8 h-8 text-purple-400" />,
    title: "Secure & Private",
    description: "End-to-end encryption ensures your conversations stay between you and your peers.",
  },
  {
    icon: <Zap className="w-8 h-8 text-yellow-400" />,
    title: "Lightning Fast",
    description: "Built on Convex for unparalleled speed and reliability across the globe.",
  },
  {
    icon: <Globe className="w-8 h-8 text-green-400" />,
    title: "Global Connectivity",
    description: "Connect with anyone, anywhere. Break down borders with seamless communication.",
  },
];

export function Features() {
  return (
    <section className="py-20 bg-gray-800">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Why Choose Antigravity?
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Redefining the way you connect with advanced features and a stunning interface.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-gray-700 p-6 rounded-xl hover:bg-gray-600 transition-colors"
            >
              <div className="mb-4 bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 text-center">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-center">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
