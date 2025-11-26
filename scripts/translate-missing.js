#!/usr/bin/env node

/**
 * Auto-translate missing keys from English to other languages
 * This script uses the reference translations from en.json and zh-CN.json
 * to generate translations for fr, es, ru, pt
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

// Translation mappings based on common patterns from existing translations
const translations = {
  fr: {
    // Common actions
    'View Details': 'Voir les détails',
    'View All': 'Voir tout',
    'Load More': 'Charger plus',
    Refresh: 'Actualiser',
    'Go Back': 'Retour',
    // Common status
    Active: 'Actif',
    Inactive: 'Inactif',
    Pending: 'En attente',
    Completed: 'Terminé',
    Operational: 'Opérationnel',
    Healthy: 'Sain',
    Connected: 'Connecté',
    'Not Configured': 'Non configuré',
    Assigned: 'Assigné',
    'All Systems Operational': 'Tous les systèmes opérationnels',
    'Minor Issues Detected': 'Problèmes mineurs détectés',
    'System Error': 'Erreur système',
    // Navigation
    Conversations: 'Conversations',
    FAQ: 'FAQ',
    'FAQ Management': 'Gestion FAQ',
    Tickets: 'Billets',
    'System Settings': 'Paramètres système',
    Customers: 'Clients',
    'My Tickets': 'Mes billets',
    Feedback: 'Commentaires',
    Complaints: 'Réclamations',
    // Auth
    'Sign in': 'Se connecter',
    'Sign up': "S'inscrire",
    Email: 'Email',
    'Enter your email and password to access your account':
      'Entrez votre email et mot de passe pour accéder à votre compte',
    'Redirecting...': 'Redirection...',
    'Taking you to your dashboard': 'Accès à votre tableau de bord',
    'Registration Disabled': 'Inscription désactivée',
    'Public registration is not available for this system':
      "L'inscription publique n'est pas disponible pour ce système",
  },
  es: {
    // Common actions
    Error: 'Error',
    No: 'No',
    'View Details': 'Ver detalles',
    'View All': 'Ver todo',
    'Load More': 'Cargar más',
    Refresh: 'Actualizar',
    'Go Back': 'Volver',
    // Common status
    Active: 'Activo',
    Inactive: 'Inactivo',
    Pending: 'Pendiente',
    Completed: 'Completado',
    Operational: 'Operacional',
    Healthy: 'Saludable',
    Connected: 'Conectado',
    'Not Configured': 'No configurado',
    Assigned: 'Asignado',
    'All Systems Operational': 'Todos los sistemas operacionales',
    'Minor Issues Detected': 'Problemas menores detectados',
    'System Error': 'Error del sistema',
    // Navigation
    'FAQ Management': 'Gestión de FAQ',
    Tickets: 'Tickets',
    'System Settings': 'Configuración del sistema',
    Customers: 'Clientes',
    'My Tickets': 'Mis tickets',
    Feedback: 'Comentarios',
    Complaints: 'Quejas',
    // Auth
    'Sign in': 'Iniciar sesión',
    'Sign up': 'Registrarse',
    'Enter your email and password to access your account':
      'Ingrese su correo electrónico y contraseña para acceder a su cuenta',
    'Redirecting...': 'Redirigiendo...',
    'Taking you to your dashboard': 'Llevándolo a su panel',
    'Registration Disabled': 'Registro deshabilitado',
    'Public registration is not available for this system':
      'El registro público no está disponible para este sistema',
  },
  ru: {
    // Common actions
    'View Details': 'Посмотреть детали',
    'View All': 'Посмотреть все',
    'Load More': 'Загрузить еще',
    Refresh: 'Обновить',
    'Go Back': 'Назад',
    // Common status
    Active: 'Активный',
    Inactive: 'Неактивный',
    Pending: 'В ожидании',
    Completed: 'Завершено',
    Operational: 'Работает',
    Healthy: 'Здоровый',
    Connected: 'Подключено',
    'Not Configured': 'Не настроено',
    Assigned: 'Назначено',
    'All Systems Operational': 'Все системы работают',
    'Minor Issues Detected': 'Обнаружены незначительные проблемы',
    'System Error': 'Системная ошибка',
    // Navigation
    'FAQ Management': 'Управление FAQ',
    'System Settings': 'Системные настройки',
    Customers: 'Клиенты',
    'My Tickets': 'Мои заявки',
    Feedback: 'Отзывы',
    Complaints: 'Жалобы',
    // Auth
    'Sign in': 'Войти',
    'Sign up': 'Зарегистрироваться',
    'Enter your email and password to access your account':
      'Введите email и пароль для доступа к аккаунту',
    'Redirecting...': 'Перенаправление...',
    'Taking you to your dashboard': 'Переход к панели управления',
    'Registration Disabled': 'Регистрация отключена',
    'Public registration is not available for this system':
      'Публичная регистрация недоступна для этой системы',
  },
  pt: {
    // Common actions
    'View Details': 'Ver detalhes',
    'View All': 'Ver tudo',
    'Load More': 'Carregar mais',
    Refresh: 'Atualizar',
    'Go Back': 'Voltar',
    // Common status
    Active: 'Ativo',
    Inactive: 'Inativo',
    Pending: 'Pendente',
    Completed: 'Concluído',
    Operational: 'Operacional',
    Healthy: 'Saudável',
    Connected: 'Conectado',
    'Not Configured': 'Não configurado',
    Assigned: 'Atribuído',
    'All Systems Operational': 'Todos os sistemas operacionais',
    'Minor Issues Detected': 'Problemas menores detectados',
    'System Error': 'Erro do sistema',
    // Navigation
    'FAQ Management': 'Gestão de FAQ',
    'System Settings': 'Configurações do sistema',
    Customers: 'Clientes',
    'My Tickets': 'Meus tickets',
    Feedback: 'Feedback',
    Complaints: 'Reclamações',
    // Auth
    'Sign in': 'Entrar',
    'Sign up': 'Registrar',
    'Enter your email and password to access your account':
      'Digite seu e-mail e senha para acessar sua conta',
    'Redirecting...': 'Redirecionando...',
    'Taking you to your dashboard': 'Levando você ao painel',
    'Registration Disabled': 'Registro desabilitado',
    'Public registration is not available for this system':
      'O registro público não está disponível para este sistema',
  },
}

function loadJSON(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveJSON(locale, data) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function translateValue(value, locale, enValue) {
  // If value is already different from English, keep it
  if (value !== enValue) {
    return value
  }

  // Check if we have a direct translation
  if (translations[locale] && translations[locale][value]) {
    return translations[locale][value]
  }

  // Keep the English value if no translation found
  return value
}

function translateObject(obj, locale, enObj) {
  const result = {}

  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      result[key] = translateObject(obj[key], locale, enObj[key] || {})
    } else {
      result[key] = translateValue(obj[key], locale, enObj[key])
    }
  }

  return result
}

function main() {
  console.log('🌍 Auto-translating common keys...\n')

  const en = loadJSON('en')
  const locales = ['fr', 'es', 'ru', 'pt']

  for (const locale of locales) {
    console.log(`📝 Processing ${locale}.json...`)

    const current = loadJSON(locale)
    const translated = translateObject(current, locale, en)

    let count = 0
    const countTranslations = (obj, origObj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          countTranslations(obj[key], origObj[key] || {})
        } else if (obj[key] !== origObj[key]) {
          count++
        }
      }
    }
    countTranslations(translated, current)

    saveJSON(locale, translated)
    console.log(`✅ Translated ${count} keys\n`)
  }

  console.log('✅ Auto-translation complete!')
  console.log('\nℹ️  Note: Many keys still need manual translation.')
  console.log('   Run "node scripts/find-untranslated.js" to see remaining keys.')
}

main()
