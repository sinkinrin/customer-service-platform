'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export function Hero() {
    const t = useTranslations('landing.hero')

    return (
        <section className="relative py-20 lg:py-32 overflow-hidden bg-white">
            <div className="container px-4 mx-auto relative z-10">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
                        {t('titlePart1')} <span className="text-blue-600">{t('titlePart2')}</span>
                    </h1>
                    <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                        {t('description')}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/auth/register">
                            <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white h-12 px-8">
                                {t('startFreeTrial')}
                            </Button>
                        </Link>
                        <Link href="/demo">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8">
                                {t('watchDemo')}
                            </Button>
                        </Link>
                    </div>
                    <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            <span>{t('freeTrial')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            <span>{t('noCreditCard')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
