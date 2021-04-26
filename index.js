require('isomorphic-fetch')
require('dotenv').config()
const fs = require('fs')
const path = require('path')

const TelegramBot = require('node-telegram-bot-api')
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

let total = 10
let partidos = {}

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
  if (!partidos[chatId]) {
    partidos[chatId] = {}
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
      `${prefix()}${jugador} ${juega ? 'juega, ' : 'no juega, ahora '}${
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

const ARCHIVO = path.resolve(__dirname, './data.json')

function cargar() {
  try {
    const json = fs.readFileSync(ARCHIVO, 'utf-8')
    data = JSON.parse(json)
    if (data && data.semana === getSemana() && data.partidos) {
      for (const chatId in data.partidos) {
        const partido = getPartido(chatId)
        for (const jugador of data.partidos[chatId]) {
          partido.add(jugador)
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      guardar()
    } else {
      console.log(`Error cargando archivo "${ARCHIVO}":`, error.message)
    }
  }
}

function guardar() {
  try {
    const semana = getSemana()
    const data = {
      semana,
      partidos: {},
    }
    if (partidos[semana]) {
      for (const chatId in partidos[semana]) {
        const partido = partidos[semana][chatId]
        if (partido instanceof Set && partido.size() > 0) {
          data.partidos[chatId] = Array.from(partido)
        }
      }
    } else {
      console.log(`No hay partidos para guardar esta semana=${semana}`)
    }
    const json = JSON.stringify(data, null, 2)
    fs.writeFileSync(ARCHIVO, json, 'utf8')
  } catch (error) {
    console.error(`Error guarando archivo "${ARCHIVO}":`, error.message)
  }
}

// Cargar partidos
cargar()

//--------------------------------------------
// Comandos
//--------------------------------------------

// saludo
bot.onText(/^hola$/i, (msg, match) => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, 'hola caracola')
})

// joder a Shibu
bot.onText(/^quien es (.+)/i, (msg, match) => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, match[1] + ' es Shibu, obvio')
})

// {nombre} no juega
bot.onText(/^((\w|\.|\-|_)+) no juega$/i, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = match[1].toLowerCase()
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    equipo.delete(jugador)
    print(chatId, jugador, false)
    guardar()
  } else {
    bot.sendMessage(chatId, `ok, igual ${jugador} no estaba anotade para jugar`)
  }
})

// {nombre} juega
bot.onText(/^((\w|\.|\-|_)+) juega$/i, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = match[1].toLowerCase()
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    bot.sendMessage(chatId, `ya anote a ${jugador}`)
  } else {
    equipo.add(jugador)
    guardar()
    print(chatId, jugador, true)
  }
})

// Juego
bot.onText(/^juego$/i, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = getJugador(msg)
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    bot.sendMessage(chatId, `ya te habia anotado, ${jugador}`)
  } else {
    equipo.add(jugador)
    guardar()
    print(chatId, jugador, true)
  }
})

// No juego
bot.onText(/^no juego$/i, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = getJugador(msg)
  const equipo = getPartido(chatId)
  if (equipo.has(jugador)) {
    equipo.delete(jugador)
    guardar()
    print(chatId, jugador, false)
  } else {
    bot.sendMessage(chatId, `ok, igual no estabas anotade para jugar`)
  }
})

// Resetear
bot.onText(/^reset$/i, (msg, match) => {
  const chatId = msg.chat.id
  const equipo = getPartido(chatId)
  for (const persona of Array.from(equipo)) {
    equipo.delete(persona)
  }
  guardar()
  bot.sendMessage(chatId, 'ok reseteo el equipo')
})

// Lista de anotados
bot.onText(
  /^(lista|anotados|quienes juegan|quien juega|quienes somos)\??$/i,
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
bot.onText(/^equipo(s)?$/i, (msg, match) => {
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
bot.onText(/^(form|formulario)$/i, (msg, match) => {
  const chatId = msg.chat.id
  bot.sendMessage(
    chatId,
    'Esta aca https://docs.google.com/forms/d/e/1FAIpQLSePfEAb7jUS-64Oo7ilXMQZISXGkvb5JLOi0k7IHYIl3JdG2g/viewform'
  )
})

// Precio crypto
bot.onText(/^precio (\w+)$/i, async (msg, match) => {
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
