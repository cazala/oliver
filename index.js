require('isomorphic-fetch')
require('dotenv').config()

const TelegramBot = require('node-telegram-bot-api')
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

let total = 10
const partidos = {}

//--------------------------------------------
// Helpers
//--------------------------------------------

function getSemana() {
  // copypasta de stack overflow :+1:
  d = new Date()
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  var weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return weekNo
}

function getJugador(msg) {
  let jugador
  if (msg.from && msg.from.first_name) {
    jugador = msg.from.first_name
  } else if (msg.from && msg.from.last_name) {
    jugador = msg.from.last_name
  } else if (msg.from && msg.from.username) {
    jugador = msg.from.username
  } else {
    jugador = msg.chat.username
  }

  jugador = jugador ? jugador.toLowerCase() : 'alguien'

  return jugador
}

function getPartido(chatId) {
  const semana = getSemana()
  if (!partidos[semana]) {
    partidos[semana] = {}
  }
  if (!partidos[semana][chatId]) {
    partidos[semana][chatId] = new Set()
  }
  return partidos[semana][chatId]
}

function prefix() {
  const n = (Math.random() * 10) | 0
  switch (n) {
    case 0:
      return 'sabe, '
    case 1:
      return 'de una, '
    case 2:
      return 'oki '
    default:
      return ''
  }
}

function print(chatId, jugador, juega) {
  const partido = getPartido(chatId)
  try {
    bot.sendMessage(
      chatId,
      `${prefix()}${jugador} ${
        juega ? 'juega, ' : 'no juega... te deseamos lo peor, ahora '
      }${
        partido.size === total
          ? 'equipos completos'
          : partido.size < total
          ? `faltan ${total - partido.size}`
          : `sobran ${partido.size - total}`
      }`
    )
  } catch (e) {
    console.log('error', e.message)
  }
}

//--------------------------------------------
// Comandos
//--------------------------------------------

// Tamaño de equipos
bot.onText(/^equipos de (\d+)/, (msg, match) => {
  const chatId = msg.chat.id
  const parsed = parseInt(match[1])
  if (!isNaN(parsed)) {
    total = parsed * 2
    bot.sendMessage(chatId, 'joya, equipos de ' + parsed)
  }
})

// saludo
bot.onText(/^(hola|Hola)$/, (msg, match) => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, 'hola caracola')
})

// joder a Shibu
bot.onText(/^quien es (.+)/, (msg, match) => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, match[1] + ' es Shibu, obvio')
})

// {nombre} no juega
bot.onText(/^((\w|\.|\-|_)+) no juega$/, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = match[1].toLowerCase()
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    equipo.delete(jugador)
    print(chatId, jugador, false)
  } else {
    bot.sendMessage(chatId, `ok, igual ${jugador} no estaba anotade para jugar`)
  }
})

// {nombre} juega
bot.onText(/^((\w|\.|\-|_)+) juega$/, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = match[1].toLowerCase()
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    bot.sendMessage(chatId, `ya anote a ${jugador}`)
  } else {
    equipo.add(jugador)
    print(chatId, jugador, true)
  }
})

// Juego
bot.onText(/^(juego|Juego)$/, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = getJugador(msg)
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    bot.sendMessage(chatId, `ya te habia anotado, ${jugador}`)
  } else {
    equipo.add(jugador)
    print(chatId, jugador, true)
  }
})

// No juego
bot.onText(/^(no juego|No juego)$/, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = getJugador(msg)
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    equipo.delete(jugador)
    print(chatId, jugador, false)
  } else {
    bot.sendMessage(chatId, `ok, igual no estabas anotade para jugar`)
  }
})

// Resetear
bot.onText(/^(reset|Reset)$/, (msg, match) => {
  const chatId = msg.chat.id
  const equipo = getPartido(chatId)
  for (const persona of Array.from(equipo)) {
    equipo.delete(persona)
  }
  bot.sendMessage(chatId, 'ok reseteo el equipo')
})

// Lista de anotados
bot.onText(
  /^(lista|Lista|anotados|Anotados|quienes juegan|quien juega|quienes juegan\?|quien juega\?)$/,
  (msg, match) => {
    const chatId = msg.chat.id
    const equipo = getPartido(chatId)
    const lista = Array.from(equipo)
    bot.sendMessage(
      chatId,
      lista.length === 0
        ? `Por ahora no hay nadie anotado`
        : `Por ahora tengo anotados a ${lista.length} personas:\n${lista.join(
            '\n'
          )}`
    )
  }
)

// Armar equipos
bot.onText(/^(equipos|Equipos|equipo|Equipo)$/, (msg, match) => {
  const chatId = msg.chat.id
  const equipo = getPartido(chatId)
  const mezcladito = shuffle(Array.from(equipo))
  const mitad = (mezcladito.length / 2) | 0
  const equipo1 = []
  const equipo2 = []
  for (let i = 0; i < mezcladito.length; i++) {
    if (i < mitad) {
      equipo1.push(mezcladito[i])
    } else {
      equipo2.push(mezcladito[i])
    }
  }
  bot.sendMessage(
    chatId,
    `Equipo del bien:
${equipo1.join('\n')}

Equipo del mal:
${equipo2.join('\n')}`
  )
})

// Formulario COVID
bot.onText(/^(form|formulario|Form|Formulario)$/, (msg, match) => {
  const chatId = msg.chat.id
  bot.sendMessage(
    chatId,
    'Esta aca https://docs.google.com/forms/d/e/1FAIpQLSdI8b2xc0ZZ8G8VxZm-ysUrqVSdSRgSuH2A18h8t6TDrI6Gdg/viewform'
  )
})

// Precio crypto
bot.onText(/^precio (\w+)$/, async (msg, match) => {
  const chatId = msg.chat.id
  const crypto = match[1].toLowerCase()
  try {
    const data = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${crypto}&vs_currencies=usd`
    ).then((r) => r.json())
    if (crypto in data) {
      const precio = data[crypto].usd
      bot.sendMessage(chatId, `$${precio.toLocaleString()}`)
    } else {
      throw new Error()
    }
  } catch (e) {
    bot.sendMessage(chatId, 'uf ni idea')
  }
})

// debug
bot.onText(/^debug/, (msg, match) => {
  const chatId = msg.chat.id
  const semana = getSemana()
  bot.sendMessage(chatId, `chatId: ${chatId}, semana: ${semana}`)
})

function shuffle(array) {
  let i = array.length
  let temp
  let rand

  while (0 !== i) {
    rand = Math.floor(Math.random() * i)
    i--
    temp = array[i]
    array[i] = array[rand]
    array[rand] = temp
  }

  return array
}
