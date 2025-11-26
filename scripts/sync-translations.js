/**
 * Translation Sync Script
 *
 * Synchronizes translation files by:
 * 1. Copying missing keys from en.json to other locales
 * 2. Removing extra keys that don't exist in en.json
 * 3. Preserving existing translations
 */

const fs = require('fs')
const path = require('path')

const messagesDir = path.join(__dirname, '..', 'messages')
const locales = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']
const baseLocale = 'en'

// Load all translation files
function loadTranslations() {
  const translations = {}
  for (const locale of locales) {
    const filePath = path.join(messagesDir, `${locale}.json`)
    translations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }
  return translations
}

// Get all keys from an object (flattened)
function getAllKeys(obj, prefix = '') {
  let keys = []
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

// Get value by path
function getByPath(obj, path) {
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }
  return current
}

// Set value by path
function setByPath(obj, path, value) {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {}
    }
    current = current[keys[i]]
  }
  if (current && typeof current === 'object') {
    current[keys[keys.length - 1]] = value
  }
}

// Delete value by path
function deleteByPath(obj, path) {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) return
    current = current[keys[i]]
  }
  delete current[keys[keys.length - 1]]
}

// Simple translation placeholders (use English as fallback for now)
// In production, you would use a translation API
const translations_map = {
  'fr': {
    // Common translations
    'Loading...': 'Chargement...',
    'Save': 'Enregistrer',
    'Cancel': 'Annuler',
    'Delete': 'Supprimer',
    'Edit': 'Modifier',
    'Create': 'Créer',
    'Search': 'Rechercher',
    'Filter': 'Filtrer',
    'Close': 'Fermer',
    'Submit': 'Soumettre',
    'Back': 'Retour',
    'Next': 'Suivant',
    'Previous': 'Précédent',
    'Yes': 'Oui',
    'No': 'Non',
    'Error': 'Erreur',
    'Success': 'Succès',
    'Warning': 'Avertissement',
    'Info': 'Information',
  },
  'es': {
    'Loading...': 'Cargando...',
    'Save': 'Guardar',
    'Cancel': 'Cancelar',
    'Delete': 'Eliminar',
    'Edit': 'Editar',
    'Create': 'Crear',
    'Search': 'Buscar',
    'Filter': 'Filtrar',
    'Close': 'Cerrar',
    'Submit': 'Enviar',
    'Back': 'Volver',
    'Next': 'Siguiente',
    'Previous': 'Anterior',
    'Yes': 'Sí',
    'No': 'No',
    'Error': 'Error',
    'Success': 'Éxito',
    'Warning': 'Advertencia',
    'Info': 'Información',
  },
  'ru': {
    'Loading...': 'Загрузка...',
    'Save': 'Сохранить',
    'Cancel': 'Отмена',
    'Delete': 'Удалить',
    'Edit': 'Редактировать',
    'Create': 'Создать',
    'Search': 'Поиск',
    'Filter': 'Фильтр',
    'Close': 'Закрыть',
    'Submit': 'Отправить',
    'Back': 'Назад',
    'Next': 'Далее',
    'Previous': 'Назад',
    'Yes': 'Да',
    'No': 'Нет',
    'Error': 'Ошибка',
    'Success': 'Успех',
    'Warning': 'Пред��преждение',
    'Info': 'Информация',
  },
  'pt': {
    'Loading...': 'Carregando...',
    'Save': 'Salvar',
    'Cancel': 'Cancelar',
    'Delete': 'Excluir',
    'Edit': 'Editar',
    'Create': 'Criar',
    'Search': 'Pesquisar',
    'Filter': 'Filtrar',
    'Close': 'Fechar',
    'Submit': 'Enviar',
    'Back': 'Voltar',
    'Next': 'Próximo',
    'Previous': 'Anterior',
    'Yes': 'Sim',
    'No': 'Não',
    'Error': 'Erro',
    'Success': 'Sucesso',
    'Warning': 'Aviso',
    'Info': 'Informação',
  }
}

function translateValue(value, locale) {
  if (typeof value !== 'string') return value

  // Check if we have a translation for this exact value
  const map = translations_map[locale]
  if (map && map[value]) {
    return map[value]
  }

  // Return original English value as placeholder
  return value
}

function syncTranslations() {
  console.log('\n🌍 Syncing translation files...\n')

  const translations = loadTranslations()
  const baseKeys = getAllKeys(translations[baseLocale])

  console.log(`📊 Base locale (${baseLocale}) has ${baseKeys.length} keys\n`)

  const stats = {}

  for (const locale of locales) {
    if (locale === baseLocale) continue

    const localeKeys = getAllKeys(translations[locale])
    const missingKeys = baseKeys.filter(k => !localeKeys.includes(k))
    const extraKeys = localeKeys.filter(k => !baseKeys.includes(k))

    stats[locale] = { added: 0, removed: 0 }

    // Add missing keys
    for (const key of missingKeys) {
      const value = getByPath(translations[baseLocale], key)
      const translatedValue = translateValue(value, locale)
      setByPath(translations[locale], key, translatedValue)
      stats[locale].added++
    }

    // Remove extra keys
    for (const key of extraKeys) {
      deleteByPath(translations[locale], key)
      stats[locale].removed++
    }

    // Write updated translation file
    const filePath = path.join(messagesDir, `${locale}.json`)
    fs.writeFileSync(filePath, JSON.stringify(translations[locale], null, 2) + '\n', 'utf-8')

    console.log(`✅ ${locale}.json: +${stats[locale].added} keys, -${stats[locale].removed} keys`)
  }

  console.log('\n✨ Sync complete!')
  console.log('\n⚠️  Note: New keys use English as placeholder. Manual translation recommended.')
}

// Run sync
syncTranslations()
