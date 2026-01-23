'use client'

import { Bot, Ticket, BookOpen, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

const featureKeys = [
    { key: 'aiChat', icon: Bot },
    { key: 'ticketManagement', icon: Ticket },
    { key: 'knowledgeBase', icon: BookOpen },
    { key: 'analytics', icon: BarChart3 },
] as const

export function Features() {
    const t = useTranslations('landing.features')

    return (
        <section className="py-24 bg-slate-50">
            <div className="container px-4 mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">{t('title')}</h2>
                    <p className="text-slate-600">
                        {t('description')}
                    </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {featureKeys.map((feature) => (
                        <div key={feature.key} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t(`${feature.key}.name`)}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {t(`${feature.key}.description`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
