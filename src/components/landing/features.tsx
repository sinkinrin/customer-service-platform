import { Truck, BarChart3, Shield, Clock } from 'lucide-react'

const features = [
    {
        name: 'Real-time Tracking',
        description: 'Monitor your fleet locations and status in real-time with advanced GPS integration.',
        icon: Truck,
    },
    {
        name: 'Performance Analytics',
        description: 'Get detailed insights into fuel usage, driver behavior, and maintenance needs.',
        icon: BarChart3,
    },
    {
        name: 'Safety & Compliance',
        description: 'Ensure your fleet meets all regulatory requirements and safety standards automatically.',
        icon: Shield,
    },
    {
        name: 'Maintenance Scheduling',
        description: 'Automated alerts and scheduling for vehicle maintenance to prevent downtime.',
        icon: Clock,
    },
]

export function Features() {
    return (
        <section className="py-24 bg-slate-50">
            <div className="container px-4 mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to manage your fleet</h2>
                    <p className="text-slate-600">
                        Powerful features designed to help you reduce costs, improve safety, and increase operational efficiency.
                    </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature) => (
                        <div key={feature.name} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.name}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
