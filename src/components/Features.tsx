
import React from 'react';
import { Calendar, Clock, Users, BarChart3, Shield, Smartphone } from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: Calendar,
      title: 'Smart Leave Planning',
      description: 'Plan and track all types of leave with our intelligent calendar system that prevents conflicts and overlaps.'
    },
    {
      icon: Clock,
      title: 'Instant Approvals',
      description: 'Streamlined approval workflow with automated notifications and real-time status updates for faster processing.'
    },
    {
      icon: Users,
      title: 'Team Management',
      description: 'Manage multiple teams and departments with role-based access controls and customizable approval hierarchies.'
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Comprehensive reporting and analytics to track leave patterns, team availability, and operational insights.'
    },
    {
      icon: Shield,
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security with GDPR compliance and data encryption to protect sensitive employee information.'
    },
    {
      icon: Smartphone,
      title: 'Mobile Ready',
      description: 'Access your leave management system anywhere with our responsive design and mobile-first approach.'
    }
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need for Leave Management
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-16">
            Our comprehensive platform provides all the tools you need to manage employee leave efficiently and effectively.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-8 rounded-xl bg-gray-50 hover:bg-purple-50 transition-all duration-300 hover:shadow-lg hover-scale group"
            >
              <div className="w-14 h-14 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center mb-6 group-hover:from-purple-200 group-hover:to-pink-200 transition-colors duration-300">
                <feature.icon className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors duration-200">
            Explore All Features
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;
