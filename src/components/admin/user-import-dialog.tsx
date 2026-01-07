'use client'

import { useState, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Upload,
    Loader2,
    AlertCircle,
    CheckCircle,
    FileText,
    X,
    Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface PreviewUser {
    email: string
    full_name: string
    role: string
    region: string
    phone?: string
}

interface ImportResult {
    success: boolean
    email: string
    error?: string
    zammad_id?: number
}

interface UserImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportComplete?: () => void
}

export function UserImportDialog({ open, onOpenChange, onImportComplete }: UserImportDialogProps) {
    const t = useTranslations('admin.users.importDialog')
    const tUsers = useTranslations('admin.users')
    const tToast = useTranslations('toast.admin.users')
    const tCommon = useTranslations('common')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
    const [previewUsers, setPreviewUsers] = useState<PreviewUser[]>([])
    const [parseErrors, setParseErrors] = useState<string[]>([])
    const [importResults, setImportResults] = useState<ImportResult[]>([])
    const [summary, setSummary] = useState<{ total: number; success: number; failed: number } | null>(null)
    const [loading, setLoading] = useState(false)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        if (!selectedFile.name.endsWith('.csv')) {
            toast.error(tToast('validationError'))
            return
        }

        setFile(selectedFile)
        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('preview', 'true')

            const response = await fetch('/api/admin/users/import', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            if (data.success) {
                setPreviewUsers(data.data.users)
                setParseErrors(data.data.errors || [])
                setStep('preview')
            } else {
                toast.error(data.error || 'Failed to parse CSV')
            }
        } catch {
            toast.error(tToast('createError'))
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        if (!file) return

        setStep('importing')
        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('preview', 'false')

            const response = await fetch('/api/admin/users/import', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            if (data.success) {
                setImportResults(data.data.results)
                setSummary(data.data.summary)
                setStep('complete')
                if (data.data.summary.success > 0) {
                    toast.success(tToast('importSuccess', { count: data.data.summary.success }))
                    onImportComplete?.()
                }
            } else {
                toast.error(data.error || 'Import failed')
                setStep('preview')
            }
        } catch {
            toast.error(tToast('createError'))
            setStep('preview')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setFile(null)
        setStep('upload')
        setPreviewUsers([])
        setParseErrors([])
        setImportResults([])
        setSummary(null)
        onOpenChange(false)
    }

    const downloadTemplate = () => {
        const template = 'email,full_name,role,region,phone\nexample@company.com,John Doe,customer,asia-pacific,+1234567890'
        const blob = new Blob([template], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'user-import-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t(`description.${step}`)}
                    </DialogDescription>
                </DialogHeader>

                {/* Upload Step */}
                {step === 'upload' && (
                    <div className="space-y-4">
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                                "hover:border-primary hover:bg-muted/50"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            {loading ? (
                                <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-muted-foreground" />
                            ) : (
                                <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                            )}
                            <p className="text-sm text-muted-foreground">
                                {loading ? t('dropzone.processing') : t('dropzone.ready')}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={downloadTemplate}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('downloadTemplate')}
                        </Button>
                    </div>
                )}

                {/* Preview Step */}
                {step === 'preview' && (
                    <div className="space-y-4">
                        {parseErrors.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="font-medium">{t('parseWarnings', { count: parseErrors.length })}</span>
                                </div>
                                <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                                    {parseErrors.slice(0, 5).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                    {parseErrors.length > 5 && <li>{t('parseMore', { count: parseErrors.length - 5 })}</li>}
                                </ul>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {t('previewCount', { count: previewUsers.length })}
                            </span>
                            <Badge variant="outline">{file?.name}</Badge>
                        </div>

                        <ScrollArea className="h-[300px] border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{tUsers('table.email')}</TableHead>
                                        <TableHead>{tUsers('table.name')}</TableHead>
                                        <TableHead>{tUsers('table.role')}</TableHead>
                                        <TableHead>{tUsers('table.region')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewUsers.map((user, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                                            <TableCell>{user.full_name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{user.role}</Badge>
                                            </TableCell>
                                            <TableCell>{user.region}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                )}

                {/* Importing Step */}
                {step === 'importing' && (
                    <div className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground">{t('importingMessage')}</p>
                    </div>
                )}

                {/* Complete Step */}
                {step === 'complete' && summary && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-2xl font-bold">{summary.total}</p>
                                <p className="text-sm text-muted-foreground">{t('summary.total')}</p>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-2xl font-bold text-green-600">{summary.success}</p>
                                <p className="text-sm text-muted-foreground">{t('summary.success')}</p>
                            </div>
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
                                <p className="text-sm text-muted-foreground">{t('summary.failed')}</p>
                            </div>
                        </div>

                        {importResults.filter(r => !r.success).length > 0 && (
                            <ScrollArea className="h-[200px] border rounded-md p-3">
                                <p className="font-medium mb-2">{t('failedImports')}</p>
                                {importResults.filter(r => !r.success).map((result, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-red-600 mb-1">
                                        <X className="h-4 w-4" />
                                        <span>{result.email}: {result.error}</span>
                                    </div>
                                ))}
                            </ScrollArea>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {step === 'upload' && (
                        <Button variant="outline" onClick={handleClose}>{tCommon('cancel')}</Button>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('upload')}>{tCommon('back')}</Button>
                            <Button onClick={handleImport} disabled={previewUsers.length === 0}>
                                {t('importAction', { count: previewUsers.length })}
                            </Button>
                        </>
                    )}
                    {step === 'complete' && (
                        <Button onClick={handleClose}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {t('done')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
