/**
 * FAQ Data for Database Seeding
 *
 * Based on the Trouble Shooting document for device support.
 * Provides translations in all 6 supported languages: en, zh-CN, fr, es, ru, pt
 */

export interface MockFAQCategory {
  id: number
  name: string
  description: string
  icon: string
}

export interface MockFAQTranslation {
  locale: string
  title: string
  content: string
  keywords: string[]
}

export interface MockFAQArticle {
  id: number
  categoryId: number
  translations: MockFAQTranslation[]
  views: number
}

export const mockFAQCategories: MockFAQCategory[] = [
  {
    id: 1,
    name: 'device-startup',
    description: 'Device boot issues, power problems, and loading failures',
    icon: 'power',
  },
  {
    id: 2,
    name: 'gps-location',
    description: 'GPS signal, antenna, and positioning issues',
    icon: 'map-pin',
  },
  {
    id: 3,
    name: 'network-platform',
    description: 'Platform connection, SIM card, and dialing issues',
    icon: 'wifi',
  },
  {
    id: 4,
    name: 'video-storage',
    description: 'Video loss, disk detection, and recording problems',
    icon: 'hard-drive',
  },
  {
    id: 5,
    name: 'alarm-upload',
    description: 'Alarm video generation and upload issues',
    icon: 'alert-triangle',
  },
  {
    id: 6,
    name: 'general-troubleshooting',
    description: 'General problem diagnosis methodology and tips',
    icon: 'wrench',
  },
]

export const mockFAQArticles: MockFAQArticle[] = [
  // ========== Category 1: Device Startup ==========
  {
    id: 1,
    categoryId: 1,
    views: 320,
    translations: [
      {
        locale: 'en',
        title: 'Device does not start up — Power LED is not on',
        content:
          '## Power LED is not on\n\nIf the power LED is not illuminated, follow these steps:\n\n1. **Check the power source** — Verify that the power source has the correct voltage.\n2. **Check the fuse** — Inspect the fuse in the power cable.\n3. **Replace the device** — Try replacing with another device to determine whether the hardware is faulty.',
        keywords: ['power', 'LED', 'startup', 'fuse', 'voltage', 'boot'],
      },
      {
        locale: 'zh-CN',
        title: '设备无法启动 — 电源指示灯不亮',
        content:
          '## 电源指示灯不亮\n\n如果电源指示灯不亮，请按以下步骤排查：\n\n1. **检查电源** — 确认电源是否有正确的电压输出。\n2. **检查保险丝** — 检查电源线中的保险丝是否完好。\n3. **更换设备** — 尝试更换另一台设备以判断是否为硬件故障。',
        keywords: ['电源', '指示灯', '启动', '保险丝', '电压', '开机'],
      },
      {
        locale: 'fr',
        title: "L'appareil ne démarre pas — Le voyant d'alimentation est éteint",
        content:
          "## Le voyant d'alimentation est éteint\n\nSi le voyant d'alimentation n'est pas allumé, suivez ces étapes :\n\n1. **Vérifiez la source d'alimentation** — Vérifiez que la source d'alimentation a la tension correcte.\n2. **Vérifiez le fusible** — Inspectez le fusible dans le câble d'alimentation.\n3. **Remplacez l'appareil** — Essayez de remplacer par un autre appareil pour déterminer si le matériel est défectueux.",
        keywords: ['alimentation', 'voyant', 'démarrage', 'fusible', 'tension', 'démarrer'],
      },
      {
        locale: 'es',
        title: 'El dispositivo no arranca — El LED de encendido no está encendido',
        content:
          '## El LED de encendido no está encendido\n\nSi el LED de encendido no está iluminado, siga estos pasos:\n\n1. **Verifique la fuente de alimentación** — Compruebe que la fuente de alimentación tiene el voltaje correcto.\n2. **Verifique el fusible** — Inspeccione el fusible en el cable de alimentación.\n3. **Reemplace el dispositivo** — Intente reemplazar con otro dispositivo para determinar si el hardware está defectuoso.',
        keywords: ['alimentación', 'LED', 'arranque', 'fusible', 'voltaje', 'encendido'],
      },
      {
        locale: 'ru',
        title: 'Устройство не запускается — Индикатор питания не горит',
        content:
          '## Индикатор питания не горит\n\nЕсли индикатор питания не горит, выполните следующие шаги:\n\n1. **Проверьте источник питания** — Убедитесь, что источник питания обеспечивает правильное напряжение.\n2. **Проверьте предохранитель** — Осмотрите предохранитель в кабеле питания.\n3. **Замените устройство** — Попробуйте заменить другим устройством, чтобы определить, неисправно ли оборудование.',
        keywords: ['питание', 'индикатор', 'запуск', 'предохранитель', 'напряжение', 'загрузка'],
      },
      {
        locale: 'pt',
        title: 'O dispositivo não inicia — O LED de energia não está aceso',
        content:
          '## O LED de energia não está aceso\n\nSe o LED de energia não estiver aceso, siga estas etapas:\n\n1. **Verifique a fonte de alimentação** — Confirme que a fonte de alimentação tem a tensão correta.\n2. **Verifique o fusível** — Inspecione o fusível no cabo de alimentação.\n3. **Substitua o dispositivo** — Tente substituir por outro dispositivo para determinar se o hardware está com defeito.',
        keywords: ['energia', 'LED', 'inicialização', 'fusível', 'tensão', 'ligar'],
      },
    ],
  },
  {
    id: 2,
    categoryId: 1,
    views: 280,
    translations: [
      {
        locale: 'en',
        title: 'Device does not start up — Power LED is on',
        content:
          '## Power LED is on but device does not boot\n\nIf the power LED is on but the device fails to start:\n\n1. **Check the HDD lock** — Make sure the HDD lock is in the locked position.\n2. **Check the power source** — Verify the power supply is stable and within normal range.\n3. **Check the ACC cable** — Ensure the ACC cable (Yellow) is properly connected.\n4. **Replace the device** — Try another device to check whether the hardware is faulty.',
        keywords: ['power', 'LED', 'HDD', 'ACC', 'boot', 'startup'],
      },
      {
        locale: 'zh-CN',
        title: '设备无法启动 — 电源指示灯亮但不开机',
        content:
          '## 电源指示灯亮但设备不启动\n\n如果电源指示灯亮但设备无法启动：\n\n1. **检查硬盘锁** — 确保硬盘锁处于锁定位置。\n2. **检查电源** — 确认供电稳定且在正常范围内。\n3. **检查ACC线缆** — 确保ACC线缆（黄色）已正确连接。\n4. **更换设备** — 尝试更换另一台设备以判断是否为硬件故障。',
        keywords: ['电源', '指示灯', '硬盘锁', 'ACC', '启动', '开机'],
      },
      {
        locale: 'fr',
        title: "L'appareil ne démarre pas — Le voyant d'alimentation est allumé",
        content:
          "## Le voyant est allumé mais l'appareil ne démarre pas\n\nSi le voyant d'alimentation est allumé mais l'appareil ne démarre pas :\n\n1. **Vérifiez le verrou du disque dur** — Assurez-vous que le verrou du disque dur est en position verrouillée.\n2. **Vérifiez la source d'alimentation** — Vérifiez que l'alimentation est stable et dans la plage normale.\n3. **Vérifiez le câble ACC** — Assurez-vous que le câble ACC (jaune) est correctement connecté.\n4. **Remplacez l'appareil** — Essayez un autre appareil pour vérifier si le matériel est défectueux.",
        keywords: ['alimentation', 'voyant', 'disque dur', 'ACC', 'démarrage', 'verrou'],
      },
      {
        locale: 'es',
        title: 'El dispositivo no arranca — El LED de encendido está encendido',
        content:
          '## El LED está encendido pero el dispositivo no arranca\n\nSi el LED de encendido está encendido pero el dispositivo no arranca:\n\n1. **Verifique el bloqueo del HDD** — Asegúrese de que el bloqueo del disco duro esté en la posición bloqueada.\n2. **Verifique la fuente de alimentación** — Compruebe que la alimentación sea estable y esté dentro del rango normal.\n3. **Verifique el cable ACC** — Asegúrese de que el cable ACC (amarillo) esté correctamente conectado.\n4. **Reemplace el dispositivo** — Pruebe con otro dispositivo para verificar si el hardware está defectuoso.',
        keywords: ['alimentación', 'LED', 'disco duro', 'ACC', 'arranque', 'bloqueo'],
      },
      {
        locale: 'ru',
        title: 'Устройство не запускается — Индикатор питания горит',
        content:
          '## Индикатор горит, но устройство не загружается\n\nЕсли индикатор питания горит, но устройство не запускается:\n\n1. **Проверьте замок HDD** — Убедитесь, что замок жёсткого диска находится в закрытом положении.\n2. **Проверьте источник питания** — Убедитесь, что питание стабильно и в нормальном диапазоне.\n3. **Проверьте кабель ACC** — Убедитесь, что кабель ACC (жёлтый) правильно подключён.\n4. **Замените устройство** — Попробуйте другое устройство для проверки аппаратной исправности.',
        keywords: ['питание', 'индикатор', 'жёсткий диск', 'ACC', 'загрузка', 'замок'],
      },
      {
        locale: 'pt',
        title: 'O dispositivo não inicia — O LED de energia está aceso',
        content:
          '## O LED está aceso mas o dispositivo não inicia\n\nSe o LED de energia está aceso mas o dispositivo não inicia:\n\n1. **Verifique a trava do HDD** — Certifique-se de que a trava do disco rígido está na posição travada.\n2. **Verifique a fonte de alimentação** — Confirme que a alimentação está estável e dentro da faixa normal.\n3. **Verifique o cabo ACC** — Certifique-se de que o cabo ACC (amarelo) está conectado corretamente.\n4. **Substitua o dispositivo** — Tente outro dispositivo para verificar se o hardware está com defeito.',
        keywords: ['energia', 'LED', 'disco rígido', 'ACC', 'inicialização', 'trava'],
      },
    ],
  },
  {
    id: 3,
    categoryId: 1,
    views: 250,
    translations: [
      {
        locale: 'en',
        title: 'Device stuck in the Loading screen',
        content:
          '## Stuck in the Loading screen\n\nIf the device is stuck on the loading screen, try these solutions:\n\n1. **Power cycle** — Power off the device completely. Wait until the power indicator is off, then power it on again.\n2. **USB firmware upgrade** — Create a folder named **UpgradeDaemon** on a USB flash drive, place the firmware file inside, then insert it into the device and power on.\n3. **Flash firmware** — Follow the firmware flashing procedure according to the documentation.',
        keywords: ['loading', 'stuck', 'boot', 'firmware', 'upgrade', 'USB'],
      },
      {
        locale: 'zh-CN',
        title: '设备卡在加载界面',
        content:
          '## 卡在加载界面\n\n如果设备卡在加载画面，请尝试以下解决方案：\n\n1. **重新上电** — 完全关闭设备电源。等到电源指示灯熄灭后，再重新开机。\n2. **USB固件升级** — 在U盘上创建名为 **UpgradeDaemon** 的文件夹，将固件文件放入其中，然后插入设备并开机。\n3. **刷写固件** — 按照文档说明进行固件刷写操作。',
        keywords: ['加载', '卡住', '启动', '固件', '升级', 'USB'],
      },
      {
        locale: 'fr',
        title: "L'appareil est bloqué sur l'écran de chargement",
        content:
          "## Bloqué sur l'écran de chargement\n\nSi l'appareil est bloqué sur l'écran de chargement, essayez ces solutions :\n\n1. **Redémarrage** — Éteignez complètement l'appareil. Attendez que le voyant d'alimentation s'éteigne, puis rallumez-le.\n2. **Mise à jour via USB** — Créez un dossier nommé **UpgradeDaemon** sur une clé USB, placez-y le fichier du firmware, puis insérez-la dans l'appareil et allumez-le.\n3. **Flasher le firmware** — Suivez la procédure de flashage du firmware selon la documentation.",
        keywords: ['chargement', 'bloqué', 'démarrage', 'firmware', 'mise à jour', 'USB'],
      },
      {
        locale: 'es',
        title: 'El dispositivo se queda en la pantalla de carga',
        content:
          '## Atascado en la pantalla de carga\n\nSi el dispositivo se queda en la pantalla de carga, pruebe estas soluciones:\n\n1. **Reinicio completo** — Apague el dispositivo completamente. Espere hasta que el indicador de encendido se apague, luego enciéndalo de nuevo.\n2. **Actualización por USB** — Cree una carpeta llamada **UpgradeDaemon** en una memoria USB, coloque el archivo de firmware dentro, luego insértela en el dispositivo y enciéndalo.\n3. **Flashear firmware** — Siga el procedimiento de flasheo de firmware según la documentación.',
        keywords: ['carga', 'atascado', 'arranque', 'firmware', 'actualización', 'USB'],
      },
      {
        locale: 'ru',
        title: 'Устройство зависло на экране загрузки',
        content:
          '## Зависло на экране загрузки\n\nЕсли устройство зависло на экране загрузки, попробуйте следующие решения:\n\n1. **Перезагрузка** — Полностью выключите устройство. Дождитесь, пока индикатор питания погаснет, затем снова включите.\n2. **Обновление через USB** — Создайте папку **UpgradeDaemon** на USB-накопителе, поместите в неё файл прошивки, затем вставьте в устройство и включите.\n3. **Прошивка** — Выполните процедуру прошивки согласно документации.',
        keywords: ['загрузка', 'зависание', 'запуск', 'прошивка', 'обновление', 'USB'],
      },
      {
        locale: 'pt',
        title: 'O dispositivo está travado na tela de carregamento',
        content:
          '## Travado na tela de carregamento\n\nSe o dispositivo está travado na tela de carregamento, tente estas soluções:\n\n1. **Reinicialização** — Desligue o dispositivo completamente. Aguarde até que o indicador de energia se apague, depois ligue-o novamente.\n2. **Atualização via USB** — Crie uma pasta chamada **UpgradeDaemon** em um pen drive, coloque o arquivo de firmware dentro, insira no dispositivo e ligue-o.\n3. **Gravar firmware** — Siga o procedimento de gravação de firmware de acordo com a documentação.',
        keywords: ['carregamento', 'travado', 'inicialização', 'firmware', 'atualização', 'USB'],
      },
    ],
  },
  {
    id: 4,
    categoryId: 1,
    views: 200,
    translations: [
      {
        locale: 'en',
        title: 'Device keeps rebooting',
        content:
          '## Device keeps rebooting\n\nIf the device continuously reboots, check the following:\n\n1. **Power supply** — Ensure the device has a sufficient and stable power supply.\n2. **Configuration** — Check if you imported the wrong device model parameters. Different models of device parameters cannot be used with each other because their parameter structure is different. Mixed use may cause software faults.\n3. **Flash firmware** — Re-flash the firmware according to the documentation.',
        keywords: ['reboot', 'restart', 'loop', 'power', 'config', 'firmware'],
      },
      {
        locale: 'zh-CN',
        title: '设备反复重启',
        content:
          '## 设备反复重启\n\n如果设备持续重启，请检查以下几点：\n\n1. **供电** — 确保设备有充足且稳定的电源供应。\n2. **配置** — 检查是否导入了错误型号的设备参数。不同型号的设备参数不能混用，因为参数结构不同，混用可能导致软件故障。\n3. **刷写固件** — 按照文档说明重新刷写固件。',
        keywords: ['重启', '循环', '电源', '配置', '固件', '参数'],
      },
      {
        locale: 'fr',
        title: "L'appareil redémarre en boucle",
        content:
          "## L'appareil redémarre en boucle\n\nSi l'appareil redémarre continuellement, vérifiez les points suivants :\n\n1. **Alimentation** — Assurez-vous que l'appareil dispose d'une alimentation suffisante et stable.\n2. **Configuration** — Vérifiez si vous avez importé les mauvais paramètres de modèle d'appareil. Les paramètres de différents modèles ne sont pas interchangeables car leur structure est différente. Un mélange peut provoquer des pannes logicielles.\n3. **Flasher le firmware** — Reflashez le firmware selon la documentation.",
        keywords: ['redémarrage', 'boucle', 'alimentation', 'configuration', 'firmware', 'paramètres'],
      },
      {
        locale: 'es',
        title: 'El dispositivo se reinicia constantemente',
        content:
          '## El dispositivo se reinicia constantemente\n\nSi el dispositivo se reinicia continuamente, verifique lo siguiente:\n\n1. **Alimentación** — Asegúrese de que el dispositivo tiene una alimentación suficiente y estable.\n2. **Configuración** — Verifique si importó los parámetros del modelo de dispositivo incorrecto. Los parámetros de diferentes modelos no son intercambiables porque su estructura es diferente. El uso mixto puede causar fallos de software.\n3. **Flashear firmware** — Vuelva a flashear el firmware según la documentación.',
        keywords: ['reinicio', 'bucle', 'alimentación', 'configuración', 'firmware', 'parámetros'],
      },
      {
        locale: 'ru',
        title: 'Устройство постоянно перезагружается',
        content:
          '## Устройство постоянно перезагружается\n\nЕсли устройство непрерывно перезагружается, проверьте следующее:\n\n1. **Питание** — Убедитесь, что устройство имеет достаточное и стабильное питание.\n2. **Конфигурация** — Проверьте, не были ли импортированы параметры неправильной модели устройства. Параметры разных моделей не взаимозаменяемы, так как их структура отличается. Смешанное использование может вызвать программные сбои.\n3. **Прошивка** — Перепрошейте устройство согласно документации.',
        keywords: ['перезагрузка', 'цикл', 'питание', 'конфигурация', 'прошивка', 'параметры'],
      },
      {
        locale: 'pt',
        title: 'O dispositivo reinicia constantemente',
        content:
          '## O dispositivo reinicia constantemente\n\nSe o dispositivo reinicia continuamente, verifique o seguinte:\n\n1. **Alimentação** — Certifique-se de que o dispositivo tem alimentação suficiente e estável.\n2. **Configuração** — Verifique se importou os parâmetros do modelo de dispositivo errado. Parâmetros de modelos diferentes não são intercambiáveis porque a estrutura é diferente. O uso misto pode causar falhas de software.\n3. **Gravar firmware** — Regrave o firmware de acordo com a documentação.',
        keywords: ['reinicialização', 'loop', 'alimentação', 'configuração', 'firmware', 'parâmetros'],
      },
    ],
  },

  // ========== Category 2: GPS & Location ==========
  {
    id: 5,
    categoryId: 2,
    views: 350,
    translations: [
      {
        locale: 'en',
        title: 'No GPS signal',
        content:
          '## No GPS signal\n\nIf the device has no GPS signal, check the following:\n\n1. **Antenna connection** — Verify the GPS antenna is properly connected.\n2. **Obstructions** — Check whether there is metal or other shielding above the GPS antenna.\n3. **Test outdoors** — Place the GPS antenna outside facing the sky to verify reception.\n4. **Roof installation** — If GPS signal inside the car is weak, install the antenna on the vehicle roof. Our GPS antenna is IP67 rated for outdoor use, but protect the cable from damage.\n5. **Voltage check** — Verify the GPS antenna interface outputs 3.3V. The antenna needs 3.3V power to amplify the GPS signal. If no 3.3V output, the GPS module may be faulty — replace the device.\n6. **Hardware test** — Replace with another device to check for hardware faults.',
        keywords: ['GPS', 'signal', 'antenna', 'location', 'satellite', 'no GPS'],
      },
      {
        locale: 'zh-CN',
        title: '无GPS信号',
        content:
          '## 无GPS信号\n\n如果设备没有GPS信号，请检查以下几点：\n\n1. **天线连接** — 确认GPS天线已正确连接。\n2. **遮挡物** — 检查GPS天线上方是否有金属或其他遮挡物。\n3. **室外测试** — 将GPS天线放到室外朝向天空，验证是否能接收信号。\n4. **车顶安装** — 如果车内GPS信号很弱，建议将天线安装在车顶。我们的GPS天线为IP67防护等级，可在室外使用，但需注意保护天线线缆。\n5. **电压检查** — 确认GPS天线接口输出3.3V电压。天线需要3.3V供电来放大信号。如果没有3.3V输出，GPS模块可能故障，建议更换设备。\n6. **硬件测试** — 更换另一台设备以排除硬件故障。',
        keywords: ['GPS', '信号', '天线', '定位', '卫星', '无信号'],
      },
      {
        locale: 'fr',
        title: 'Pas de signal GPS',
        content:
          "## Pas de signal GPS\n\nSi l'appareil n'a pas de signal GPS, vérifiez les points suivants :\n\n1. **Connexion de l'antenne** — Vérifiez que l'antenne GPS est correctement connectée.\n2. **Obstructions** — Vérifiez s'il y a du métal ou d'autres obstacles au-dessus de l'antenne GPS.\n3. **Test en extérieur** — Placez l'antenne GPS à l'extérieur face au ciel pour vérifier la réception.\n4. **Installation sur le toit** — Si le signal GPS à l'intérieur du véhicule est faible, installez l'antenne sur le toit. Notre antenne GPS est certifiée IP67 pour une utilisation extérieure, mais protégez le câble contre les dommages.\n5. **Vérification de tension** — Vérifiez que l'interface de l'antenne GPS délivre 3,3V. L'antenne a besoin de 3,3V pour amplifier le signal. Sans sortie 3,3V, le module GPS peut être défectueux — remplacez l'appareil.\n6. **Test matériel** — Remplacez par un autre appareil pour vérifier les défauts matériels.",
        keywords: ['GPS', 'signal', 'antenne', 'localisation', 'satellite', 'pas de GPS'],
      },
      {
        locale: 'es',
        title: 'Sin señal GPS',
        content:
          '## Sin señal GPS\n\nSi el dispositivo no tiene señal GPS, verifique lo siguiente:\n\n1. **Conexión de la antena** — Verifique que la antena GPS esté correctamente conectada.\n2. **Obstrucciones** — Compruebe si hay metal u otros obstáculos sobre la antena GPS.\n3. **Prueba al aire libre** — Coloque la antena GPS al exterior orientada hacia el cielo para verificar la recepción.\n4. **Instalación en el techo** — Si la señal GPS dentro del vehículo es débil, instale la antena en el techo. Nuestra antena GPS tiene certificación IP67 para uso exterior, pero proteja el cable contra daños.\n5. **Verificación de voltaje** — Verifique que la interfaz de la antena GPS emite 3,3V. La antena necesita 3,3V para amplificar la señal. Si no hay salida de 3,3V, el módulo GPS puede estar defectuoso — reemplace el dispositivo.\n6. **Prueba de hardware** — Reemplace con otro dispositivo para verificar fallos de hardware.',
        keywords: ['GPS', 'señal', 'antena', 'ubicación', 'satélite', 'sin GPS'],
      },
      {
        locale: 'ru',
        title: 'Нет сигнала GPS',
        content:
          '## Нет сигнала GPS\n\nЕсли устройство не получает сигнал GPS, проверьте следующее:\n\n1. **Подключение антенны** — Убедитесь, что GPS-антенна правильно подключена.\n2. **Препятствия** — Проверьте, нет ли металла или других экранирующих объектов над GPS-антенной.\n3. **Тест на улице** — Разместите GPS-антенну на открытом воздухе, направив её к небу, для проверки приёма.\n4. **Установка на крышу** — Если сигнал GPS внутри автомобиля слабый, установите антенну на крышу. Наша GPS-антенна имеет степень защиты IP67 для наружного использования, но защищайте кабель от повреждений.\n5. **Проверка напряжения** — Убедитесь, что интерфейс GPS-антенны выдаёт 3,3В. Антенне необходимо 3,3В для усиления сигнала. Если нет выхода 3,3В, модуль GPS может быть неисправен — замените устройство.\n6. **Тест оборудования** — Замените другим устройством для проверки аппаратных неисправностей.',
        keywords: ['GPS', 'сигнал', 'антенна', 'местоположение', 'спутник', 'нет GPS'],
      },
      {
        locale: 'pt',
        title: 'Sem sinal GPS',
        content:
          '## Sem sinal GPS\n\nSe o dispositivo não tem sinal GPS, verifique o seguinte:\n\n1. **Conexão da antena** — Verifique se a antena GPS está conectada corretamente.\n2. **Obstruções** — Verifique se há metal ou outros obstáculos acima da antena GPS.\n3. **Teste ao ar livre** — Coloque a antena GPS ao ar livre voltada para o céu para verificar a recepção.\n4. **Instalação no teto** — Se o sinal GPS dentro do veículo é fraco, instale a antena no teto. Nossa antena GPS possui certificação IP67 para uso externo, mas proteja o cabo contra danos.\n5. **Verificação de tensão** — Verifique se a interface da antena GPS emite 3,3V. A antena precisa de 3,3V para amplificar o sinal. Se não houver saída de 3,3V, o módulo GPS pode estar com defeito — substitua o dispositivo.\n6. **Teste de hardware** — Substitua por outro dispositivo para verificar defeitos de hardware.',
        keywords: ['GPS', 'sinal', 'antena', 'localização', 'satélite', 'sem GPS'],
      },
    ],
  },
  {
    id: 6,
    categoryId: 2,
    views: 260,
    translations: [
      {
        locale: 'en',
        title: 'GPS signal is weak',
        content:
          '## GPS signal is weak\n\nIf the GPS signal is weak, try these solutions:\n\n1. **Antenna connection** — Check if the GPS antenna is securely connected.\n2. **Position mode** — Verify the position mode is correct (Menu → System → Terminal). The recommended mode is **GPS+GL**.\n3. **Obstructions** — Check for metal or other objects shielding the GPS antenna.\n4. **Test outside** — Place the antenna outside the vehicle facing the sky to check if signal improves.\n5. **Roof installation** — If GPS signal inside the car is very weak, install the antenna on the roof. Our GPS antenna is IP67 rated, but protect the cable from damage.\n6. **Hardware test** — Replace the device or antenna to check for hardware faults.',
        keywords: ['GPS', 'weak', 'signal', 'antenna', 'position', 'GLONASS'],
      },
      {
        locale: 'zh-CN',
        title: 'GPS信号弱',
        content:
          '## GPS信号弱\n\n如果GPS信号较弱，请尝试以下解决方案：\n\n1. **天线连接** — 检查GPS天线是否连接牢固。\n2. **定位模式** — 确认定位模式设置正确（菜单→系统→终端），建议模式为 **GPS+GL**。\n3. **遮挡物** — 检查GPS天线上方是否有金属或其他遮挡物。\n4. **室外测试** — 将天线放到车外朝向天空，检查信号是否增强。\n5. **车顶安装** — 如果车内GPS信号很弱，建议将天线安装在车顶。天线为IP67防护等级可室外使用，但需保护线缆。\n6. **硬件测试** — 更换设备或天线以排除硬件故障。',
        keywords: ['GPS', '弱', '信号', '天线', '定位', 'GLONASS'],
      },
      {
        locale: 'fr',
        title: 'Signal GPS faible',
        content:
          "## Signal GPS faible\n\nSi le signal GPS est faible, essayez ces solutions :\n\n1. **Connexion de l'antenne** — Vérifiez que l'antenne GPS est solidement connectée.\n2. **Mode de positionnement** — Vérifiez que le mode est correct (Menu → Système → Terminal). Le mode recommandé est **GPS+GL**.\n3. **Obstructions** — Vérifiez s'il y a du métal ou d'autres objets qui bloquent l'antenne GPS.\n4. **Test en extérieur** — Placez l'antenne à l'extérieur du véhicule face au ciel pour vérifier si le signal s'améliore.\n5. **Installation sur le toit** — Si le signal GPS est très faible à l'intérieur, installez l'antenne sur le toit. Classée IP67, mais protégez le câble.\n6. **Test matériel** — Remplacez l'appareil ou l'antenne pour vérifier les défauts matériels.",
        keywords: ['GPS', 'faible', 'signal', 'antenne', 'position', 'GLONASS'],
      },
      {
        locale: 'es',
        title: 'La señal GPS es débil',
        content:
          '## La señal GPS es débil\n\nSi la señal GPS es débil, pruebe estas soluciones:\n\n1. **Conexión de la antena** — Verifique que la antena GPS esté firmemente conectada.\n2. **Modo de posición** — Compruebe que el modo de posición sea correcto (Menú → Sistema → Terminal). El modo recomendado es **GPS+GL**.\n3. **Obstrucciones** — Verifique si hay metal u otros objetos que bloqueen la antena GPS.\n4. **Prueba exterior** — Coloque la antena fuera del vehículo orientada hacia el cielo para verificar si la señal mejora.\n5. **Instalación en el techo** — Si la señal GPS es muy débil dentro del vehículo, instale la antena en el techo. Certificada IP67, pero proteja el cable.\n6. **Prueba de hardware** — Reemplace el dispositivo o la antena para verificar fallos de hardware.',
        keywords: ['GPS', 'débil', 'señal', 'antena', 'posición', 'GLONASS'],
      },
      {
        locale: 'ru',
        title: 'Слабый сигнал GPS',
        content:
          '## Слабый сигнал GPS\n\nЕсли сигнал GPS слабый, попробуйте следующие решения:\n\n1. **Подключение антенны** — Проверьте, надёжно ли подключена GPS-антенна.\n2. **Режим позиционирования** — Убедитесь, что режим корректный (Меню → Система → Терминал). Рекомендуемый режим — **GPS+GL**.\n3. **Препятствия** — Проверьте, нет ли металла или других объектов, экранирующих GPS-антенну.\n4. **Тест на улице** — Разместите антенну снаружи автомобиля, направив к небу, чтобы проверить улучшение сигнала.\n5. **Установка на крышу** — Если сигнал GPS очень слабый внутри, установите антенну на крышу. Степень защиты IP67, но защищайте кабель.\n6. **Тест оборудования** — Замените устройство или антенну для проверки.',
        keywords: ['GPS', 'слабый', 'сигнал', 'антенна', 'позиция', 'GLONASS'],
      },
      {
        locale: 'pt',
        title: 'Sinal GPS fraco',
        content:
          '## Sinal GPS fraco\n\nSe o sinal GPS está fraco, tente estas soluções:\n\n1. **Conexão da antena** — Verifique se a antena GPS está firmemente conectada.\n2. **Modo de posição** — Confirme que o modo de posição está correto (Menu → Sistema → Terminal). O modo recomendado é **GPS+GL**.\n3. **Obstruções** — Verifique se há metal ou outros objetos bloqueando a antena GPS.\n4. **Teste externo** — Coloque a antena fora do veículo voltada para o céu para verificar se o sinal melhora.\n5. **Instalação no teto** — Se o sinal GPS é muito fraco dentro do veículo, instale a antena no teto. Certificação IP67, mas proteja o cabo.\n6. **Teste de hardware** — Substitua o dispositivo ou a antena para verificar defeitos.',
        keywords: ['GPS', 'fraco', 'sinal', 'antena', 'posição', 'GLONASS'],
      },
    ],
  },

  // ========== Category 3: Network & Platform ==========
  {
    id: 7,
    categoryId: 3,
    views: 400,
    translations: [
      {
        locale: 'en',
        title: "Can't connect to Platform — Dial Success",
        content:
          "## Dial succeeds but cannot connect to Platform\n\nIf the device dials successfully but cannot connect to the platform:\n\n1. **Test with another device** — Check if other devices can go online to rule out platform/server issues.\n2. **Device ID** — Verify the device ID is added on the platform side. The device ID set in the device must also be registered on the platform.\n3. **Duplicate ID** — Check whether another device with the same Device ID is already online. Device IDs must be unique on the same platform; duplicates cause online conflicts.\n4. **H-Protocol** — Enable H-Protocol in Menu → Network → Center and reboot the device.\n5. **SIM card traffic** — Check if the SIM card has sufficient data. A SIM card that dials successfully but has no remaining traffic will still fail to connect.",
        keywords: ['platform', 'connect', 'online', 'dial', 'device ID', 'SIM'],
      },
      {
        locale: 'zh-CN',
        title: '无法连接平台 — 拨号成功',
        content:
          '## 拨号成功但无法连接平台\n\n如果设备拨号成功但无法连接平台：\n\n1. **测试其他设备** — 检查其他设备能否上线，以排除平台/服务器问题。\n2. **设备ID** — 确认设备ID已在平台端添加。设备端设置的ID也需要在平台端注册。\n3. **重复ID** — 检查是否有其他设备使用了相同的设备ID。同一平台上设备ID必须唯一，重复会导致在线冲突。\n4. **H协议** — 在菜单→网络→中心中启用H协议，然后重启设备。\n5. **SIM卡流量** — 检查SIM卡是否有足够的数据流量。即使拨号成功，如果没有剩余流量也无法连接平台。',
        keywords: ['平台', '连接', '在线', '拨号', '设备ID', 'SIM'],
      },
      {
        locale: 'fr',
        title: 'Impossible de se connecter à la plateforme — Numérotation réussie',
        content:
          "## La numérotation réussit mais impossible de se connecter\n\nSi l'appareil réussit à numéroter mais ne peut pas se connecter à la plateforme :\n\n1. **Testez avec un autre appareil** — Vérifiez si d'autres appareils peuvent se connecter pour exclure les problèmes de plateforme/serveur.\n2. **ID de l'appareil** — Vérifiez que l'ID de l'appareil est ajouté côté plateforme. L'ID configuré dans l'appareil doit aussi être enregistré sur la plateforme.\n3. **ID en double** — Vérifiez si un autre appareil avec le même ID est déjà en ligne. Les ID doivent être uniques sur la même plateforme.\n4. **H-Protocol** — Activez le H-Protocol dans Menu → Réseau → Centre et redémarrez l'appareil.\n5. **Trafic SIM** — Vérifiez si la carte SIM a suffisamment de données. Une carte qui numérote mais n'a plus de trafic ne pourra pas se connecter.",
        keywords: ['plateforme', 'connexion', 'en ligne', 'numérotation', 'ID appareil', 'SIM'],
      },
      {
        locale: 'es',
        title: 'No se puede conectar a la plataforma — Marcación exitosa',
        content:
          '## La marcación tiene éxito pero no se puede conectar\n\nSi el dispositivo marca exitosamente pero no puede conectarse a la plataforma:\n\n1. **Pruebe con otro dispositivo** — Verifique si otros dispositivos pueden conectarse para descartar problemas de plataforma/servidor.\n2. **ID del dispositivo** — Verifique que el ID del dispositivo esté registrado en la plataforma. El ID configurado en el dispositivo también debe estar registrado en la plataforma.\n3. **ID duplicado** — Verifique si otro dispositivo con el mismo ID ya está en línea. Los ID deben ser únicos en la misma plataforma.\n4. **H-Protocol** — Active el H-Protocol en Menú → Red → Centro y reinicie el dispositivo.\n5. **Tráfico SIM** — Verifique si la tarjeta SIM tiene datos suficientes. Una tarjeta que marca exitosamente pero sin tráfico restante no podrá conectarse.',
        keywords: ['plataforma', 'conexión', 'en línea', 'marcación', 'ID dispositivo', 'SIM'],
      },
      {
        locale: 'ru',
        title: 'Не удаётся подключиться к платформе — Дозвон успешен',
        content:
          '## Дозвон успешен, но не удаётся подключиться\n\nЕсли устройство успешно дозванивается, но не может подключиться к платформе:\n\n1. **Тест с другим устройством** — Проверьте, могут ли другие устройства выйти в сеть, чтобы исключить проблемы платформы/сервера.\n2. **ID устройства** — Убедитесь, что ID устройства добавлен на стороне платформы. ID, установленный в устройстве, также должен быть зарегистрирован на платформе.\n3. **Дублирование ID** — Проверьте, не находится ли другое устройство с таким же ID уже в сети. ID должны быть уникальны на одной платформе.\n4. **H-Protocol** — Включите H-Protocol в Меню → Сеть → Центр и перезагрузите устройство.\n5. **Трафик SIM** — Проверьте, достаточно ли данных на SIM-карте. Карта, успешно дозвонившаяся, но без оставшегося трафика, не сможет подключиться.',
        keywords: ['платформа', 'подключение', 'онлайн', 'дозвон', 'ID устройства', 'SIM'],
      },
      {
        locale: 'pt',
        title: 'Não é possível conectar à plataforma — Discagem bem-sucedida',
        content:
          '## Discagem bem-sucedida mas não conecta\n\nSe o dispositivo disca com sucesso mas não consegue conectar à plataforma:\n\n1. **Teste com outro dispositivo** — Verifique se outros dispositivos conseguem ficar online para descartar problemas de plataforma/servidor.\n2. **ID do dispositivo** — Verifique se o ID do dispositivo está cadastrado na plataforma. O ID configurado no dispositivo também deve estar registrado na plataforma.\n3. **ID duplicado** — Verifique se outro dispositivo com o mesmo ID já está online. Os IDs devem ser únicos na mesma plataforma.\n4. **H-Protocol** — Ative o H-Protocol em Menu → Rede → Centro e reinicie o dispositivo.\n5. **Tráfego SIM** — Verifique se o cartão SIM tem dados suficientes. Um cartão que disca com sucesso mas sem tráfego restante não conseguirá conectar.',
        keywords: ['plataforma', 'conexão', 'online', 'discagem', 'ID dispositivo', 'SIM'],
      },
    ],
  },
  {
    id: 8,
    categoryId: 3,
    views: 380,
    translations: [
      {
        locale: 'en',
        title: "Can't connect to Platform — Dial Failure",
        content:
          '## Dial fails\n\nIf the device cannot dial successfully:\n\n1. **4G module** — Check if the device can detect the 4G module.\n2. **SIM card detection** — Check if the device can detect the SIM card.\n3. **Dial parameters** — Verify the dial parameters are correct. **APN is critical for dial success.** You need to enable device dialing settings and set APN parameters. Keep the default center number — it cannot be changed.\n4. **4G antenna** — Check if the 4G antenna is connected. If the 4G signal is too weak (below 16), dialing will fail.\n5. **SIM card** — Try replacing with another SIM card to rule out SIM issues.',
        keywords: ['dial', 'failure', '4G', 'SIM', 'APN', 'antenna', 'network'],
      },
      {
        locale: 'zh-CN',
        title: '无法连接平台 — 拨号失败',
        content:
          '## 拨号失败\n\n如果设备无法成功拨号：\n\n1. **4G模块** — 检查设备是否能检测到4G模块。\n2. **SIM卡检测** — 检查设备是否能检测到SIM卡。\n3. **拨号参数** — 确认拨号参数设置正确。**APN对拨号成功至关重要。**需要启用设备拨号设置并配置APN参数。默认中心号码保持不变，不能修改。\n4. **4G天线** — 检查4G天线是否已连接。如果4G信号太弱（低于16），将无法成功拨号。\n5. **SIM卡** — 尝试更换其他SIM卡以排除SIM卡问题。',
        keywords: ['拨号', '失败', '4G', 'SIM', 'APN', '天线', '网络'],
      },
      {
        locale: 'fr',
        title: 'Impossible de se connecter à la plateforme — Échec de numérotation',
        content:
          "## Échec de la numérotation\n\nSi l'appareil ne peut pas numéroter avec succès :\n\n1. **Module 4G** — Vérifiez si l'appareil peut détecter le module 4G.\n2. **Détection SIM** — Vérifiez si l'appareil peut détecter la carte SIM.\n3. **Paramètres de numérotation** — Vérifiez que les paramètres sont corrects. **L'APN est essentiel pour le succès de la numérotation.** Activez les paramètres de numérotation et configurez l'APN. Conservez le numéro de centre par défaut.\n4. **Antenne 4G** — Vérifiez si l'antenne 4G est connectée. Si le signal 4G est trop faible (inférieur à 16), la numérotation échouera.\n5. **Carte SIM** — Essayez une autre carte SIM pour exclure les problèmes SIM.",
        keywords: ['numérotation', 'échec', '4G', 'SIM', 'APN', 'antenne', 'réseau'],
      },
      {
        locale: 'es',
        title: 'No se puede conectar a la plataforma — Fallo de marcación',
        content:
          '## Fallo de marcación\n\nSi el dispositivo no puede marcar exitosamente:\n\n1. **Módulo 4G** — Verifique si el dispositivo puede detectar el módulo 4G.\n2. **Detección SIM** — Verifique si el dispositivo puede detectar la tarjeta SIM.\n3. **Parámetros de marcación** — Compruebe que los parámetros sean correctos. **El APN es crítico para el éxito de la marcación.** Active la configuración de marcación y establezca los parámetros APN. Mantenga el número de centro predeterminado.\n4. **Antena 4G** — Verifique si la antena 4G está conectada. Si la señal 4G es demasiado débil (inferior a 16), la marcación fallará.\n5. **Tarjeta SIM** — Pruebe con otra tarjeta SIM para descartar problemas de SIM.',
        keywords: ['marcación', 'fallo', '4G', 'SIM', 'APN', 'antena', 'red'],
      },
      {
        locale: 'ru',
        title: 'Не удаётся подключиться к платформе — Ошибка дозвона',
        content:
          '## Ошибка дозвона\n\nЕсли устройство не может успешно дозвониться:\n\n1. **Модуль 4G** — Проверьте, обнаруживает ли устройство модуль 4G.\n2. **Обнаружение SIM** — Проверьте, обнаруживает ли устройство SIM-карту.\n3. **Параметры дозвона** — Убедитесь, что параметры корректны. **APN критически важен для успешного дозвона.** Включите настройки дозвона и установите параметры APN. Сохраните номер центра по умолчанию.\n4. **Антенна 4G** — Проверьте, подключена ли антенна 4G. Если сигнал 4G слишком слабый (ниже 16), дозвон не удастся.\n5. **SIM-карта** — Попробуйте другую SIM-карту для исключения проблем с SIM.',
        keywords: ['дозвон', 'ошибка', '4G', 'SIM', 'APN', 'антенна', 'сеть'],
      },
      {
        locale: 'pt',
        title: 'Não é possível conectar à plataforma — Falha na discagem',
        content:
          '## Falha na discagem\n\nSe o dispositivo não consegue discar com sucesso:\n\n1. **Módulo 4G** — Verifique se o dispositivo consegue detectar o módulo 4G.\n2. **Detecção do SIM** — Verifique se o dispositivo consegue detectar o cartão SIM.\n3. **Parâmetros de discagem** — Confirme que os parâmetros estão corretos. **O APN é crítico para o sucesso da discagem.** Ative as configurações de discagem e defina os parâmetros APN. Mantenha o número do centro padrão.\n4. **Antena 4G** — Verifique se a antena 4G está conectada. Se o sinal 4G for muito fraco (abaixo de 16), a discagem falhará.\n5. **Cartão SIM** — Tente outro cartão SIM para descartar problemas do SIM.',
        keywords: ['discagem', 'falha', '4G', 'SIM', 'APN', 'antena', 'rede'],
      },
    ],
  },

  // ========== Category 4: Video & Storage ==========
  {
    id: 9,
    categoryId: 4,
    views: 300,
    translations: [
      {
        locale: 'en',
        title: 'Video Loss — Disk detected',
        content:
          '## Video loss when disk is detected\n\nIf the device detects the disk but video is lost:\n\n1. **Firmware update** — Check if the device has the latest firmware. New firmware can detect disk health and recording status.\n2. **Storage alarms** — Check what storage alarms the device has reported. The device supports 13 types of disk alarms reported to the platform. View alarm details to determine the disk problem.\n3. **Remote format** — Try formatting the disk remotely. If the device frequently reports disk alarms, formatting can reset the disk. Periodically formatting (every 6 months) can help prolong disk life.\n4. **Disk specifications** — Verify the disk meets requirements. The HDD must be industrial grade. Since the device frequently writes video files, the disk must meet basic requirements (**Class 10, V30 minimum**). Consider the operating temperature range for the installation environment.',
        keywords: ['video', 'loss', 'disk', 'storage', 'HDD', 'format', 'alarm'],
      },
      {
        locale: 'zh-CN',
        title: '视频丢失 — 磁盘已检测到',
        content:
          '## 磁盘已检测到但视频丢失\n\n如果设备检测到磁盘但视频丢失：\n\n1. **固件更新** — 检查设备是否为最新固件。新固件可以检测磁盘健康状态和录像状态。\n2. **存储告警** — 检查设备报告了哪些存储告警。设备支持13种磁盘告警上报平台。查看告警详情可以判断磁盘问题。\n3. **远程格式化** — 尝试远程格式化磁盘。如果设备频繁报告磁盘告警，格式化可以重置磁盘。定期格式化（每半年一次）有助于延长磁盘寿命。\n4. **磁盘规格** — 确认磁盘符合要求。硬盘必须为工业级。由于设备频繁写入视频文件，磁盘必须满足基本要求（**至少Class 10、V30**）。还需考虑安装环境的工作温度范围。',
        keywords: ['视频', '丢失', '磁盘', '存储', '硬盘', '格式化', '告警'],
      },
      {
        locale: 'fr',
        title: 'Perte vidéo — Disque détecté',
        content:
          "## Perte vidéo avec disque détecté\n\nSi l'appareil détecte le disque mais la vidéo est perdue :\n\n1. **Mise à jour du firmware** — Vérifiez que l'appareil dispose du dernier firmware. Le nouveau firmware peut détecter l'état du disque et l'état d'enregistrement.\n2. **Alarmes de stockage** — Vérifiez les alarmes de stockage signalées. L'appareil prend en charge 13 types d'alarmes disque. Consultez les détails pour déterminer le problème.\n3. **Formatage à distance** — Essayez de formater le disque à distance. Un formatage périodique (tous les 6 mois) peut prolonger la durée de vie du disque.\n4. **Spécifications du disque** — Vérifiez que le disque répond aux exigences. Le HDD doit être de qualité industrielle (**Class 10, V30 minimum**). Considérez la plage de température de fonctionnement.",
        keywords: ['vidéo', 'perte', 'disque', 'stockage', 'HDD', 'formatage', 'alarme'],
      },
      {
        locale: 'es',
        title: 'Pérdida de video — Disco detectado',
        content:
          '## Pérdida de video con disco detectado\n\nSi el dispositivo detecta el disco pero se pierde el video:\n\n1. **Actualización de firmware** — Verifique que el dispositivo tiene el firmware más reciente. El nuevo firmware puede detectar el estado del disco y la grabación.\n2. **Alarmas de almacenamiento** — Verifique qué alarmas de almacenamiento ha reportado el dispositivo. Soporta 13 tipos de alarmas de disco. Revise los detalles para determinar el problema.\n3. **Formateo remoto** — Intente formatear el disco remotamente. El formateo periódico (cada 6 meses) puede prolongar la vida del disco.\n4. **Especificaciones del disco** — Verifique que el disco cumple los requisitos. El HDD debe ser de grado industrial (**Class 10, V30 mínimo**). Considere el rango de temperatura operativa.',
        keywords: ['video', 'pérdida', 'disco', 'almacenamiento', 'HDD', 'formateo', 'alarma'],
      },
      {
        locale: 'ru',
        title: 'Потеря видео — Диск обнаружен',
        content:
          '## Потеря видео при обнаруженном диске\n\nЕсли устройство обнаруживает диск, но видео потеряно:\n\n1. **Обновление прошивки** — Проверьте, установлена ли последняя прошивка. Новая прошивка может определять состояние диска и статус записи.\n2. **Тревоги хранилища** — Проверьте, какие тревоги хранилища сообщило устройство. Поддерживается 13 типов тревог диска. Просмотрите детали для определения проблемы.\n3. **Удалённое форматирование** — Попробуйте отформатировать диск удалённо. Периодическое форматирование (каждые 6 месяцев) может продлить срок службы диска.\n4. **Характеристики диска** — Убедитесь, что диск соответствует требованиям. HDD должен быть промышленного класса (**Class 10, V30 минимум**). Учитывайте рабочий диапазон температур.',
        keywords: ['видео', 'потеря', 'диск', 'хранилище', 'HDD', 'форматирование', 'тревога'],
      },
      {
        locale: 'pt',
        title: 'Perda de vídeo — Disco detectado',
        content:
          '## Perda de vídeo com disco detectado\n\nSe o dispositivo detecta o disco mas o vídeo é perdido:\n\n1. **Atualização de firmware** — Verifique se o dispositivo tem o firmware mais recente. O novo firmware pode detectar o estado do disco e a gravação.\n2. **Alarmes de armazenamento** — Verifique quais alarmes de armazenamento foram reportados. O dispositivo suporta 13 tipos de alarmes de disco. Revise os detalhes para determinar o problema.\n3. **Formatação remota** — Tente formatar o disco remotamente. A formatação periódica (a cada 6 meses) pode prolongar a vida útil do disco.\n4. **Especificações do disco** — Verifique se o disco atende aos requisitos. O HDD deve ser de grau industrial (**Class 10, V30 mínimo**). Considere a faixa de temperatura operacional.',
        keywords: ['vídeo', 'perda', 'disco', 'armazenamento', 'HDD', 'formatação', 'alarme'],
      },
    ],
  },
  {
    id: 10,
    categoryId: 4,
    views: 270,
    translations: [
      {
        locale: 'en',
        title: 'Video Loss — Disk not detected',
        content:
          '## Disk is not detected\n\nIf the device cannot detect the disk:\n\n1. **Check if the HDD is broken** — The physical interface of the hard disk may be damaged, preventing the device from making contact with the HDD.\n2. **Check HDD connection** — The hard drive must be properly installed into the caddy and secured using four Phillips screws to fix the HDD firmly.\n3. **Check if the device is faulty** — The disk cannot be detected because of a device hardware fault. Replace the device for testing.',
        keywords: ['disk', 'HDD', 'detect', 'connection', 'broken', 'hardware'],
      },
      {
        locale: 'zh-CN',
        title: '视频丢失 — 未检测到磁盘',
        content:
          '## 未检测到磁盘\n\n如果设备无法检测到磁盘：\n\n1. **检查硬盘是否损坏** — 硬盘的物理接口可能损坏，导致设备无法与硬盘接触。\n2. **检查硬盘连接** — 硬盘必须正确安装到硬盘托架中，并使用四颗十字螺丝固定。\n3. **检查设备是否故障** — 由于设备硬件故障，可能无法检测到磁盘。更换设备进行测试。',
        keywords: ['磁盘', '硬盘', '检测', '连接', '损坏', '硬件'],
      },
      {
        locale: 'fr',
        title: 'Perte vidéo — Disque non détecté',
        content:
          "## Disque non détecté\n\nSi l'appareil ne peut pas détecter le disque :\n\n1. **Vérifiez si le HDD est cassé** — L'interface physique du disque dur peut être endommagée, empêchant le contact avec l'appareil.\n2. **Vérifiez la connexion du HDD** — Le disque dur doit être correctement installé dans le berceau et fixé avec quatre vis cruciformes.\n3. **Vérifiez si l'appareil est défectueux** — Le disque ne peut pas être détecté en raison d'un défaut matériel. Remplacez l'appareil pour tester.",
        keywords: ['disque', 'HDD', 'détection', 'connexion', 'cassé', 'matériel'],
      },
      {
        locale: 'es',
        title: 'Pérdida de video — Disco no detectado',
        content:
          '## Disco no detectado\n\nSi el dispositivo no puede detectar el disco:\n\n1. **Verifique si el HDD está dañado** — La interfaz física del disco duro puede estar dañada, impidiendo el contacto con el dispositivo.\n2. **Verifique la conexión del HDD** — El disco duro debe estar correctamente instalado en la bandeja y asegurado con cuatro tornillos Phillips.\n3. **Verifique si el dispositivo está defectuoso** — El disco no puede ser detectado debido a un fallo de hardware. Reemplace el dispositivo para probar.',
        keywords: ['disco', 'HDD', 'detección', 'conexión', 'dañado', 'hardware'],
      },
      {
        locale: 'ru',
        title: 'Потеря видео — Диск не обнаружен',
        content:
          '## Диск не обнаружен\n\nЕсли устройство не может обнаружить диск:\n\n1. **Проверьте, не повреждён ли HDD** — Физический интерфейс жёсткого диска может быть повреждён, что препятствует контакту с устройством.\n2. **Проверьте подключение HDD** — Жёсткий диск должен быть правильно установлен в корзину и закреплён четырьмя крестовыми винтами.\n3. **Проверьте, исправно ли устройство** — Диск не обнаруживается из-за аппаратной неисправности. Замените устройство для тестирования.',
        keywords: ['диск', 'HDD', 'обнаружение', 'подключение', 'повреждён', 'оборудование'],
      },
      {
        locale: 'pt',
        title: 'Perda de vídeo — Disco não detectado',
        content:
          '## Disco não detectado\n\nSe o dispositivo não consegue detectar o disco:\n\n1. **Verifique se o HDD está danificado** — A interface física do disco rígido pode estar danificada, impedindo o contato com o dispositivo.\n2. **Verifique a conexão do HDD** — O disco rígido deve ser instalado corretamente na bandeja e fixado com quatro parafusos Phillips.\n3. **Verifique se o dispositivo está com defeito** — O disco não pode ser detectado devido a um defeito de hardware. Substitua o dispositivo para teste.',
        keywords: ['disco', 'HDD', 'detecção', 'conexão', 'danificado', 'hardware'],
      },
    ],
  },

  // ========== Category 5: Alarm & Upload ==========
  {
    id: 11,
    categoryId: 5,
    views: 220,
    translations: [
      {
        locale: 'en',
        title: "Alarm video can't upload — Not generated",
        content:
          "## Alarm video files are not generated\n\nIf alarm video files are not being generated:\n\n1. **Device parameters** — Check if the device parameters are set correctly for alarm recording.\n2. **Disk detection** — Verify the device has detected the disk.\n3. **Disk health** — Check if the disk has problems. When a disk is inserted into the device, it is divided into two partitions: a visible partition for storing the video stream, and an invisible partition for storing alarm videos. If the disk is faulty, the device cannot generate alarm video files.",
        keywords: ['alarm', 'video', 'upload', 'generate', 'disk', 'partition'],
      },
      {
        locale: 'zh-CN',
        title: '报警视频无法上传 — 未生成',
        content:
          '## 报警视频文件未生成\n\n如果报警视频文件未生成：\n\n1. **设备参数** — 检查设备参数是否正确配置了报警录像。\n2. **磁盘检测** — 确认设备已检测到磁盘。\n3. **磁盘健康** — 检查磁盘是否有问题。磁盘插入设备后会分为两个分区：一个可见分区用于存储视频流，一个不可见分区用于存储报警视频。如果磁盘故障，设备无法生成报警视频文件。',
        keywords: ['报警', '视频', '上传', '生成', '磁盘', '分区'],
      },
      {
        locale: 'fr',
        title: "La vidéo d'alarme ne peut pas être téléchargée — Non générée",
        content:
          "## Les fichiers vidéo d'alarme ne sont pas générés\n\nSi les fichiers vidéo d'alarme ne sont pas générés :\n\n1. **Paramètres de l'appareil** — Vérifiez que les paramètres sont correctement configurés pour l'enregistrement d'alarme.\n2. **Détection du disque** — Vérifiez que l'appareil a détecté le disque.\n3. **Santé du disque** — Vérifiez si le disque a des problèmes. Le disque est divisé en deux partitions : une partition visible pour le flux vidéo et une partition invisible pour les vidéos d'alarme. Si le disque est défectueux, l'appareil ne peut pas générer les fichiers.",
        keywords: ['alarme', 'vidéo', 'téléchargement', 'génération', 'disque', 'partition'],
      },
      {
        locale: 'es',
        title: 'El video de alarma no se puede subir — No generado',
        content:
          '## Los archivos de video de alarma no se generan\n\nSi los archivos de video de alarma no se generan:\n\n1. **Parámetros del dispositivo** — Verifique que los parámetros estén correctamente configurados para la grabación de alarma.\n2. **Detección del disco** — Confirme que el dispositivo ha detectado el disco.\n3. **Salud del disco** — Verifique si el disco tiene problemas. El disco se divide en dos particiones: una visible para el flujo de video y una invisible para los videos de alarma. Si el disco está defectuoso, no se pueden generar los archivos.',
        keywords: ['alarma', 'video', 'subida', 'generación', 'disco', 'partición'],
      },
      {
        locale: 'ru',
        title: 'Тревожное видео не загружается — Не сгенерировано',
        content:
          '## Файлы тревожного видео не генерируются\n\nЕсли файлы тревожного видео не генерируются:\n\n1. **Параметры устройства** — Проверьте, правильно ли настроены параметры для записи тревожного видео.\n2. **Обнаружение диска** — Убедитесь, что устройство обнаружило диск.\n3. **Состояние диска** — Проверьте, нет ли проблем с диском. Диск разделяется на два раздела: видимый для потокового видео и невидимый для тревожного видео. Если диск неисправен, устройство не может генерировать файлы.',
        keywords: ['тревога', 'видео', 'загрузка', 'генерация', 'диск', 'раздел'],
      },
      {
        locale: 'pt',
        title: 'Vídeo de alarme não pode ser enviado — Não gerado',
        content:
          '## Arquivos de vídeo de alarme não são gerados\n\nSe os arquivos de vídeo de alarme não estão sendo gerados:\n\n1. **Parâmetros do dispositivo** — Verifique se os parâmetros estão configurados corretamente para gravação de alarme.\n2. **Detecção do disco** — Confirme que o dispositivo detectou o disco.\n3. **Saúde do disco** — Verifique se o disco tem problemas. O disco é dividido em duas partições: uma visível para o fluxo de vídeo e uma invisível para vídeos de alarme. Se o disco estiver com defeito, o dispositivo não pode gerar os arquivos.',
        keywords: ['alarme', 'vídeo', 'upload', 'geração', 'disco', 'partição'],
      },
    ],
  },
  {
    id: 12,
    categoryId: 5,
    views: 190,
    translations: [
      {
        locale: 'en',
        title: "Alarm video can't upload — Generated but not uploaded",
        content:
          "## Alarm video generated but not uploaded\n\nIf alarm video files are generated but cannot be uploaded to the platform:\n\n1. **Device parameters** — Check if the device parameters are set correctly for alarm upload.\n2. **Test with other devices** — Check if other devices can upload alarm videos to rule out platform/server issues.\n3. **Standard partition** — Check if the disk has problems with the standard partition. If the disk has issues, the device may not write alarm info to the disk and cannot upload to the platform.\n4. **Contact support** — Describe the problem symptoms and provide platform account info, or point the device to our server for checking.",
        keywords: ['alarm', 'video', 'upload', 'platform', 'partition', 'transfer'],
      },
      {
        locale: 'zh-CN',
        title: '报警视频无法上传 — 已生成但未上传',
        content:
          '## 报警视频已生成但未上传\n\n如果报警视频文件已生成但无法上传到平台：\n\n1. **设备参数** — 检查设备参数是否正确配置了报警上传。\n2. **测试其他设备** — 检查其他设备能否上传报警视频，以排除平台/服务器问题。\n3. **标准分区** — 检查磁盘的标准分区是否有问题。如果磁盘有问题，设备可能无法将报警信息写入磁盘，也无法上传到平台。\n4. **联系支持** — 描述问题症状并提供平台账号信息，或将设备指向我们的服务器进行检查。',
        keywords: ['报警', '视频', '上传', '平台', '分区', '传输'],
      },
      {
        locale: 'fr',
        title: "La vidéo d'alarme ne peut pas être téléchargée — Générée mais non envoyée",
        content:
          "## Vidéo d'alarme générée mais non envoyée\n\nSi les fichiers vidéo d'alarme sont générés mais ne peuvent pas être envoyés à la plateforme :\n\n1. **Paramètres de l'appareil** — Vérifiez que les paramètres sont correctement configurés pour l'envoi d'alarme.\n2. **Test avec d'autres appareils** — Vérifiez si d'autres appareils peuvent envoyer les vidéos d'alarme pour exclure les problèmes de plateforme/serveur.\n3. **Partition standard** — Vérifiez si le disque a des problèmes de partition standard. Si le disque a des problèmes, l'appareil ne peut pas écrire les informations d'alarme.\n4. **Contactez le support** — Décrivez les symptômes et fournissez les informations de compte, ou redirigez l'appareil vers notre serveur.",
        keywords: ['alarme', 'vidéo', 'envoi', 'plateforme', 'partition', 'transfert'],
      },
      {
        locale: 'es',
        title: 'El video de alarma no se puede subir — Generado pero no subido',
        content:
          '## Video de alarma generado pero no subido\n\nSi los archivos de video de alarma se generan pero no se pueden subir a la plataforma:\n\n1. **Parámetros del dispositivo** — Verifique que los parámetros estén correctamente configurados para la subida de alarma.\n2. **Pruebe con otros dispositivos** — Verifique si otros dispositivos pueden subir videos de alarma para descartar problemas de plataforma/servidor.\n3. **Partición estándar** — Verifique si el disco tiene problemas con la partición estándar. Si el disco tiene problemas, el dispositivo no puede escribir la información de alarma.\n4. **Contacte soporte** — Describa los síntomas y proporcione la información de cuenta de la plataforma, o apunte el dispositivo a nuestro servidor.',
        keywords: ['alarma', 'video', 'subida', 'plataforma', 'partición', 'transferencia'],
      },
      {
        locale: 'ru',
        title: 'Тревожное видео не загружается — Сгенерировано, но не отправлено',
        content:
          '## Тревожное видео сгенерировано, но не отправлено\n\nЕсли файлы тревожного видео сгенерированы, но не могут быть загружены на платформу:\n\n1. **Параметры устройства** — Проверьте, правильно ли настроены параметры для загрузки тревожного видео.\n2. **Тест с другими устройствами** — Проверьте, могут ли другие устройства загружать тревожное видео, чтобы исключить проблемы платформы/сервера.\n3. **Стандартный раздел** — Проверьте, нет ли проблем со стандартным разделом диска. Если есть проблемы, устройство не может записать информацию о тревоге.\n4. **Обратитесь в поддержку** — Опишите симптомы и предоставьте данные аккаунта платформы, или перенаправьте устройство на наш сервер.',
        keywords: ['тревога', 'видео', 'загрузка', 'платформа', 'раздел', 'передача'],
      },
      {
        locale: 'pt',
        title: 'Vídeo de alarme não pode ser enviado — Gerado mas não enviado',
        content:
          '## Vídeo de alarme gerado mas não enviado\n\nSe os arquivos de vídeo de alarme são gerados mas não podem ser enviados à plataforma:\n\n1. **Parâmetros do dispositivo** — Verifique se os parâmetros estão configurados corretamente para o envio de alarme.\n2. **Teste com outros dispositivos** — Verifique se outros dispositivos conseguem enviar vídeos de alarme para descartar problemas de plataforma/servidor.\n3. **Partição padrão** — Verifique se o disco tem problemas com a partição padrão. Se o disco tiver problemas, o dispositivo não pode gravar as informações de alarme.\n4. **Contate o suporte** — Descreva os sintomas e forneça as informações da conta da plataforma, ou aponte o dispositivo para nosso servidor.',
        keywords: ['alarme', 'vídeo', 'envio', 'plataforma', 'partição', 'transferência'],
      },
    ],
  },

  // ========== Category 6: General Troubleshooting ==========
  {
    id: 13,
    categoryId: 6,
    views: 500,
    translations: [
      {
        locale: 'en',
        title: 'General troubleshooting methodology',
        content:
          '## General Troubleshooting Steps\n\nWhen encountering any issue, follow this systematic approach:\n\n### 1. Define the problem\nDescribe the problem symptom clearly. Include basic device information: device model, device ID, firmware version, and installation status.\n\n### 2. Know the basic information\nGather all relevant device details before proceeding with troubleshooting.\n\n### 3. Observe the pattern\nObserve the device behavior, find any regularity, locate the trigger mechanism, and determine whether it is a batch problem affecting multiple devices.\n\n### 4. Capture the evidence\nCapture device logs. If the device is connected via serial port in the office, log analysis can be printed for detailed examination.\n\n### 5. Contact support\nProvide platform account info or point the device to our server for remote checking.',
        keywords: ['troubleshooting', 'methodology', 'diagnosis', 'logs', 'support', 'general'],
      },
      {
        locale: 'zh-CN',
        title: '通用故障排除方法',
        content:
          '## 通用故障排除步骤\n\n遇到任何问题时，请遵循以下系统化方法：\n\n### 1. 定义问题\n清晰描述问题症状。包含基本设备信息：设备型号、设备ID、固件版本和安装状态。\n\n### 2. 了解基本信息\n在开始排查之前，收集所有相关的设备详细信息。\n\n### 3. 观察规律\n观察设备行为，找到规律性，定位触发机制，并判断是否为批量性问题。\n\n### 4. 抓取证据\n抓取设备日志。如果设备在办公室通过串口连接，可以打印日志进行详细分析。\n\n### 5. 联系支持\n提供平台账号信息或将设备指向我们的服务器进行远程检查。',
        keywords: ['故障排除', '方法', '诊断', '日志', '支持', '通用'],
      },
      {
        locale: 'fr',
        title: 'Méthodologie générale de dépannage',
        content:
          "## Étapes générales de dépannage\n\nLorsque vous rencontrez un problème, suivez cette approche systématique :\n\n### 1. Définir le problème\nDécrivez clairement les symptômes. Incluez les informations de base : modèle, ID de l'appareil, version du firmware et état d'installation.\n\n### 2. Connaître les informations de base\nRassemblez tous les détails pertinents de l'appareil avant de procéder au dépannage.\n\n### 3. Observer le comportement\nObservez le comportement de l'appareil, trouvez des régularités, identifiez le mécanisme déclencheur et déterminez s'il s'agit d'un problème de lot.\n\n### 4. Capturer les preuves\nCapturez les journaux de l'appareil. Si l'appareil est connecté via port série, l'analyse des journaux peut être imprimée.\n\n### 5. Contacter le support\nFournissez les informations de compte ou redirigez l'appareil vers notre serveur pour une vérification à distance.",
        keywords: ['dépannage', 'méthodologie', 'diagnostic', 'journaux', 'support', 'général'],
      },
      {
        locale: 'es',
        title: 'Metodología general de resolución de problemas',
        content:
          '## Pasos generales de resolución de problemas\n\nAl encontrar cualquier problema, siga este enfoque sistemático:\n\n### 1. Definir el problema\nDescriba claramente los síntomas. Incluya información básica del dispositivo: modelo, ID, versión de firmware y estado de instalación.\n\n### 2. Conocer la información básica\nRecopile todos los detalles relevantes del dispositivo antes de proceder con la resolución.\n\n### 3. Observar el patrón\nObserve el comportamiento del dispositivo, encuentre regularidades, localice el mecanismo desencadenante y determine si es un problema masivo.\n\n### 4. Capturar evidencia\nCapture los registros del dispositivo. Si el dispositivo está conectado por puerto serie, el análisis puede imprimirse.\n\n### 5. Contactar soporte\nProporcione la información de cuenta de la plataforma o apunte el dispositivo a nuestro servidor para verificación remota.',
        keywords: ['resolución', 'metodología', 'diagnóstico', 'registros', 'soporte', 'general'],
      },
      {
        locale: 'ru',
        title: 'Общая методология устранения неполадок',
        content:
          '## Общие шаги по устранению неполадок\n\nПри возникновении любой проблемы следуйте этому системному подходу:\n\n### 1. Определите проблему\nЧётко опишите симптомы. Укажите основную информацию: модель устройства, ID, версию прошивки и статус установки.\n\n### 2. Узнайте базовую информацию\nСоберите все необходимые данные об устройстве перед началом диагностики.\n\n### 3. Наблюдайте за поведением\nНаблюдайте за поведением устройства, найдите закономерности, определите механизм срабатывания и выясните, является ли проблема массовой.\n\n### 4. Зафиксируйте доказательства\nЗахватите логи устройства. При подключении через последовательный порт можно распечатать анализ логов.\n\n### 5. Обратитесь в поддержку\nПредоставьте данные аккаунта платформы или перенаправьте устройство на наш сервер для удалённой проверки.',
        keywords: ['устранение неполадок', 'методология', 'диагностика', 'логи', 'поддержка', 'общее'],
      },
      {
        locale: 'pt',
        title: 'Metodologia geral de solução de problemas',
        content:
          '## Passos gerais para solução de problemas\n\nAo encontrar qualquer problema, siga esta abordagem sistemática:\n\n### 1. Definir o problema\nDescreva claramente os sintomas. Inclua informações básicas: modelo do dispositivo, ID, versão do firmware e status da instalação.\n\n### 2. Conhecer as informações básicas\nReúna todos os detalhes relevantes do dispositivo antes de prosseguir com a solução.\n\n### 3. Observar o padrão\nObserve o comportamento do dispositivo, encontre regularidades, localize o mecanismo de disparo e determine se é um problema em lote.\n\n### 4. Capturar evidências\nCapture os logs do dispositivo. Se o dispositivo estiver conectado via porta serial, a análise pode ser impressa.\n\n### 5. Contatar o suporte\nForneça as informações da conta da plataforma ou aponte o dispositivo para nosso servidor para verificação remota.',
        keywords: ['solução de problemas', 'metodologia', 'diagnóstico', 'logs', 'suporte', 'geral'],
      },
    ],
  },
]
