require('isomorphic-fetch')
require('dotenv').config()
const fs = require('fs')
const path = require('path')

const TelegramBot = require('node-telegram-bot-api')
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

const Weekday = Object.freeze({
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
})

let total = 10
let partidos = {}
let weekResetDayByChatId = {}

let dateDayOffset = 0

//--------------------------------------------
// Helpers
//--------------------------------------------

function getWeekdayName(weekday) {
  switch (weekday) {
    case Weekday.Monday: return "lunes"
    case Weekday.Tuesday: return "martes"
    case Weekday.Wednesday: return "miercoles"
    case Weekday.Thursday: return "jueves"
    case Weekday.Friday: return "viernes"
    case Weekday.Saturday: return "sabado"
    case Weekday.Sunday: return "domingo"
  }
}

function getWeekdayFromName(name) {
  switch (name) {
    case "lunes": return Weekday.Monday
    case "martes": return Weekday.Tuesday
    case "miercoles": return Weekday.Wednesday
    case "jueves": return Weekday.Thursday
    case "viernes": return Weekday.Friday
    case "sabado": return Weekday.Saturday
    case "domingo": return Weekday.Sunday
  }
}

function getWeekResetDayForChatId(chatId) {

  if (weekResetDayByChatId[chatId] === undefined) {
    weekResetDayByChatId[chatId] = Weekday.Monday
  }

  return weekResetDayByChatId[chatId]
}

function getCurrentDate() {
  var date = new Date()
  date.setUTCDate(date.getUTCDate() + dateDayOffset)
  return date
}

function getSemana(chatId) {
  var resetDay = getWeekResetDayForChatId(chatId)
  return getWeekNumberForDateStartingOnWeekday(getCurrentDate(), resetDay)
}

function getWeekNumberForDateStartingOnWeekday(date, startOfWeek) {
  
  var dayOfWeek = date.getUTCDay()
  if (dayOfWeek < startOfWeek) {
    dayOfWeek = dayOfWeek + 7
  }
  
  // copypasta de stack overflow :+1:
  var weekThursday = date.getUTCDate() + 4 - dayOfWeek
  date.setUTCDate(weekThursday)
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart)) / 86400000 + 1) / 7)
}

function getJugador(msg) {
  let jugador
  if (msg.from && msg.from.first_name) {
    jugador = msg.from.first_name
  } else if (msg.from && msg.from.last_name) {
    jugador = msg.from.last_name
  } else if (msg.from && msg.from.username) {
    jugador = msg.from.username
  } else if (msg.chat) {
    jugador = msg.chat.username
  }

  jugador = jugador ? jugador.toLowerCase() : 'alguien'

  return jugador
}

function getPartido(chatId) {
  
  const semana = getSemana(chatId)

  if (!partidos[chatId]) {
    partidos[chatId] = {}
  }

  if (!partidos[chatId][semana]) {
    partidos[chatId][semana] = new Set()
  }

  return partidos[chatId][semana]
}

function sendReplyMessage(chatId, jugador, juega, withExclamation) {
  try {
    bot.sendMessage(
      chatId,
      createReplyMessage(jugador, getPartido(chatId), juega, withExclamation)
    )
  } catch (error) {
    console.log('Error loco:', error.message)
  }
}

function createReplyMessage(jugador, partido, juega, withExclamation) {
  return `${replyMessagePrefix(juega, withExclamation)}${jugador} ${juega ? 'juega,' : 'no juega, ahora'} ${replyMessagePostfix(partido)}`
}

function replyMessagePrefix(juega, withExclamation) {
  return juega ? replyPlayMessagePrefix(withExclamation) : replyNotPlayMessagePrefix()
}

function replyPlayMessagePrefix(withExclamation) {
  const n = (Math.random() * (withExclamation ? 5 : 10)) | 0

    switch (n) {
      case 0:
        return withExclamation ? 'Sabe! ' : 'Sabe, '
      case 1:
        return withExclamation ? 'Sapbe! ' : 'Sapbe, '
      case 2:
        return withExclamation ? 'De una! ' : 'De una, '
      case 3:
        return withExclamation ? 'De one! ' : 'De one, '
      case 4:
        return withExclamation ? 'Oki! ' : 'Oki '
      default:
        return ''
    }
}

function replyNotPlayMessagePrefix() {
  const n = (Math.random() * 4) | 0

  switch (n) {
    case 0:
      return "Uh! Oki, "
    case 1:
      return "Malisimo... "
    case 2:
      return "Bueno, "
    case 3:
      return "Bajon! "
  }
}

function replyMessagePostfix(partido) {
  return partido.size === total
    ? 'equipos completos!'
    : partido.size < total
      ? `faltan ${total - partido.size}`
      : `sobran ${partido.size - total}`
}

const ARCHIVO = path.resolve(__dirname, './data_v2.json')

function cargar() {
  try {
    
    console.log(`Cargando partidos`)
    const json = fs.readFileSync(ARCHIVO, 'utf-8')
    data = JSON.parse(json)
    if (
      data &&
      data.partidos &&
      Object.keys(data.partidos).length > 0
    ) {
      loadMatches(data)
    } else {
      console.log('No hay partidos')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      guardar()
    } else {
      console.log(`Error cargando archivo "${ARCHIVO}":`, error.message)
    }
  }
}

function loadMatches(data) {
  for (const chatId in data.partidos) {
    loadMatchForChatId(chatId, data.partidos[chatId])
  }
}

function loadMatchForChatId(chatId, chatIdData) {
  
  console.log(`Cargando partido para chatId "${chatId}"`)

  const dataWeekResetDay = chatIdData.week_reset_day
  const dataWeekNumber = chatIdData.week_number

  var weekResetDay = getWeekdayFromName(dataWeekResetDay)
  weekResetDayByChatId[chatId] = weekResetDay

  console.log(`Dia de reset "${dataWeekResetDay}" (${weekResetDay})`)

  const semana = getSemana(chatId)
  
  if (semana === dataWeekNumber) {
    console.log(`Cargando jugadores al partido`)

    const partido = getPartido(chatId)

    for (const jugador of chatIdData.players) {
      console.log(`Agregando jugador "${jugador}"`)
      partido.add(jugador)
    }
  }
  else {
    console.log(`Omitiendo carga de jugadores. La semana actual ("${semana}") no coincide con la semana guardada ("${dataWeekNumber}")`)
  }
}

function getData() {
  
  const data = {
    partidos: {},
  }

  for (const chatId in partidos) {

    var week = getSemana(chatId)
    var weekResetDay = getWeekdayName(getWeekResetDayForChatId(chatId))
    var players = []

    var playersForCurrentWeek = partidos[chatId][week]
    if (playersForCurrentWeek instanceof Set) {
      players = Array.from(playersForCurrentWeek)
    }

    const chatIdData = {
      week_number: week,
      week_reset_day: weekResetDay,
      players: players
    }

    data.partidos[chatId] = chatIdData
  }

  return data
}

function resetMatchForChatId(chatId) {
  const partido = getPartido(chatId)
  for (const persona of Array.from(partido)) {
    partido.delete(persona)
  }
}

function guardar() {
  try {
    const data = getData()
    const json = JSON.stringify(data, null, 2)
    fs.writeFile(ARCHIVO, json, 'utf8', (error) => {
      if (error) {
        console.log('Error:', error.message)
      }
      console.log('Guardado!')
    })
  } catch (error) {
    console.log(`Error guardando archivo "${ARCHIVO}":`, error.message)
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
  bot.sendMessage(chatId, 'Hola caracola')
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
  const partido = getPartido(chatId)
  if (partido.has(jugador)) {
    partido.delete(jugador)
    sendReplyMessage(chatId, jugador, false, false)
  } else {
    bot.sendMessage(chatId, `Ok, igual ${jugador} no estaba anotade para jugar`)
  }
  guardar()
})

// {nombre} juega
bot.onText(/^((\w|\.|\-|_)+) juega$/i, (msg, match) => {
  onSomeonePlaysMessageReceived(msg, match, false)
})

// {nombre} juega!
bot.onText(/^((\w|\.|\-|_)+) juega!$/i, (msg, match) => {
  onSomeonePlaysMessageReceived(msg, match, true)
})

function onSomeonePlaysMessageReceived(message, match, withExclamation) {
  const chatId = message.chat.id
  const jugador = match[1].toLowerCase()
  const partido = getPartido(chatId)
  if (partido.has(jugador)) {
    bot.sendMessage(chatId, `Ya anote a ${jugador}`)
  } else {
    partido.add(jugador)
    sendReplyMessage(chatId, jugador, true, withExclamation)
    guardar()
  }
}

// {nombre-1} {nombre-2} ...{nombre-N} juegan
bot.onText(/^((\w|\s|\.|\-|_)+) juegan$/i, (msg, match) => {
  const chatId = msg.chat.id
  const jugadores = match[1]
    .split(' ')
    .filter((jugador) => !!jugador)
    .map((jugador) => jugador.toLowerCase())
  if (jugadores.length > 0) {
    const partido = getPartido(chatId)
    for (const jugador of jugadores) {
      partido.add(jugador)
    }
    if (jugadores.length === 1) {
      sendReplyMessage(chatId, jugadores[0], true, false)
    } else {
      bot.sendMessage(chatId, `Listo, anote a los ${jugadores.length}`)
    }
    guardar()
  }
})

// Juego
bot.onText(/^juego$/i, (msg, match) => {
  onPlayMessageReceived(msg, false)
})

// Juego
bot.onText(/^juego!$/i, (msg, match) => {
  onPlayMessageReceived(msg, true)
})

function onPlayMessageReceived(message, withExclamation) {
  const chatId = message.chat.id
  const jugador = getJugador(message)
  const partido = getPartido(chatId)
  if (partido.has(jugador)) {
    bot.sendMessage(chatId, `Ya te habia anotado, ${jugador}`)
  } else {
    partido.add(jugador)
    sendReplyMessage(chatId, jugador, true, withExclamation)
    guardar()
  }
}

// No juego
bot.onText(/^no juego$/i, (msg, match) => {
  const chatId = msg.chat.id
  const jugador = getJugador(msg)
  const partido = getPartido(chatId)
  if (partido.has(jugador)) {
    partido.delete(jugador)
    sendReplyMessage(chatId, jugador, false, false)
  } else {
    bot.sendMessage(chatId, `Ok, igual no estabas anotade para jugar`)
  }
  guardar()
})

// Resetear
bot.onText(/^reset$/i, (msg, match) => {
  const chatId = msg.chat.id
  resetMatchForChatId(chatId)
  bot.sendMessage(chatId, 'Ok, reseteo el equipo')
  guardar()
})

// Lista de anotados
bot.onText(
  /^(lista|anotados|quienes juegan|quien juega|quienes somos)\??$/i,
  (msg, match) => {
    const chatId = msg.chat.id
    const partido = getPartido(chatId)
    const lista = Array.from(partido)
    bot.sendMessage(
      chatId,
      lista.length === 0
        ? `Por ahora no hay nadie anotade`
        : `Por ahora tengo anotadas a ${lista.length} personas:\n${lista.join(
            '\n'
          )}`
    )
  }
)

// Armar equipos
bot.onText(/^equipo(s)?$/i, (msg, match) => {
  const chatId = msg.chat.id
  const partido = getPartido(chatId)
  const mezcladito = shuffle(Array.from(partido))
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

// Cambia el dia de la semana en que se resetean los partidos
bot.onText(/^\/reset_on (\w+)$/i, (msg, match) => {
  const chatId = msg.chat.id
  const resetDayString = match[1].toLowerCase()
  const resetDay = getWeekdayFromName(resetDayString)

  var message = ""

  if (resetDay !== undefined) {
    weekResetDayByChatId[chatId] = resetDay
    resetMatchForChatId(chatId)
    message = `Oki, los partidos se van a resetear los dias ${resetDayString}`
  }
  else {
    message = `Mmm no entendi que dia me dijiste... Ojo que no entiendo los acentos!`
  }

  bot.sendMessage(chatId, message)
  guardar()
})

// debug
bot.onText(/^\/debug$/i, (msg, match) => {
  const chatId = msg.chat.id
  const semana = getSemana(chatId)
  const partido = getPartido(chatId)
  const weekResetDay = getWeekResetDayForChatId(chatId)
  bot.sendMessage(
    chatId,
    `chatId: ${chatId}\n` +
    `Reset dia: ${ getWeekdayName(weekResetDay) }\n` + 
    `Semana numero: ${ semana }\n` + 
    `Fecha: ${ getCurrentDate().toUTCString() }\n` + 
    `Partido: ${ partido.size === 0 ? 'nadie anotado' : Array.from(partido).join(', ') }\n\n` + 
    `data: ${ JSON.stringify(getData(), null, 2) }`
  )
})

// Back to the Future
bot.onText(/^\/debug_bttf (-?\d*)$/i, (msg, match) => {
  const chatId = msg.chat.id
  dateDayOffset = dateDayOffset + parseInt(match[1])
  bot.sendMessage(chatId, 
    `Ahora la fecha esta desfasada ${ dateDayOffset } dias.\n` + 
    `La fecha es ${ getCurrentDate().toUTCString() }`)
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
