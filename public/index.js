const socket = io({autoConnect: false})
socket.auth = {
    sessionID: sessionStorage.getItem('sessionID'), 
    username: sessionStorage.getItem('username')
}
socket.connect()

const seeUsersButton = document.createElement('button')
seeUsersButton.innerText = 'see users'
document.querySelector('body').prepend(seeUsersButton)
seeUsersButton.addEventListener('click', () => {
    socket.emit('see users')
})

const actionButton = document.createElement('button')
actionButton.innerText = 'action'
document.querySelector('body').append(actionButton)
actionButton.addEventListener('click', () => {
    const bet = parseInt(prompt('how much'))
    socket.emit('action', bet)
})

const lobby_list = document.getElementById('lobby-list')
const login_button = document.getElementById('login-button')
const action_bar = document.getElementById('action-bar')
const his_name_plate = document.getElementById('his-name-plate')
const my_name_plate = document.getElementById('my-name-plate')
const my_chip = document.getElementById('my-chip')
const his_chip = document.getElementById('his-chip')
const pot_chip = document.getElementById('pot-chip')
const sit_out = document.getElementById('sit-out')
const auto_post = document.getElementById('auto-post')
const auto_muck = document.getElementById('auto-muck')
const my_pocket_1 = document.getElementById('my-pocket-1')
const my_pocket_2 = document.getElementById('my-pocket-2')
const board = document.getElementById('board')
const board_1 = document.getElementById('board-1')
const board_2 = document.getElementById('board-2')
const board_3 = document.getElementById('board-3')
const board_4 = document.getElementById('board-4')
const board_5 = document.getElementById('board-5')

if (sessionStorage.getItem('username')) {
    login_button.innerText = sessionStorage.getItem('username')
}

function displayBets(state) {
    if (sessionStorage.getItem('myPosition') == 'big blind') {
        my_chip.innerText = state.bigBlindAlreadyIn
        his_chip.innerText = state.buttonAlreadyIn
        his_name_plate.innerText = state.button + '\n' + (state.buttonStack - state.buttonAlreadyIn)
        my_name_plate.innerText = state.bigBlind + '\n' + (state.bigBlindStack - state.bigBlindAlreadyIn)
    } else {
        my_chip.innerText = state.buttonAlreadyIn
        his_chip.innerText = state.bigBlindAlreadyIn
        his_name_plate.innerText = state.bigBlind + '\n' + (state.bigBlindStack - state.bigBlindAlreadyIn)
        my_name_plate.innerText = state.button + '\n' + (state.buttonStack - state.buttonAlreadyIn)
    }
    pot_chip.innerText = state.pot
}

login_button.addEventListener('click', () => {
    if (login_button.innerText == 'login') {
        const username = prompt('choose a screen name')
        if (username) {
            socket.emit('login', username)
            sessionStorage.setItem('username', username)
        }
        login_button.innerText = username
    } else {
        sessionStorage.removeItem('username')
        socket.emit('logout')
        login_button.innerText= 'login'
    }
})

lobby_list.addEventListener('click', (event) => {
    const children = Array.from(lobby_list.children)
    if (children.includes(event.target)) {
        socket.emit('challenge', event.target.innerText)
    }

})


action_bar.addEventListener('click', (event) => {
    const children = Array.from(action_bar.children)
    if (children.includes(event.target)) {
        socket.emit('action', event.target.betValue)
        while (action_bar.firstChild) {
            action_bar.removeChild(action_bar.firstChild)
        }
    
    }

})

auto_post.addEventListener('click', () => {
    if (sessionStorage.getItem('auto post') === 'false') {
        sessionStorage.setItem('auto post', 'true')
    } else {
        sessionStorage.setItem('auto post', 'false')
    }
})

socket.on('sessionID', sessionID => {
    sessionStorage.setItem('sessionID', sessionID)
})

socket.on('players', players => {
    while (lobby_list.firstChild) {
        lobby_list.removeChild(lobby_list.firstChild)
    }
    players.forEach( x => {
        if (x == sessionStorage.getItem('username')) {
            return
        }
        const li = document.createElement('li')
        li.setAttribute('id', x)
        li.innerText = x
        lobby_list.appendChild(li)
    })
})

socket.on('login', username => {
    if (username == sessionStorage.getItem('username')) {
        return
    }
    const li = document.createElement('li')
    li.setAttribute('id', username)
    li.innerText = username
    lobby_list.appendChild(li)
})

socket.on('logout', username => {
    const li = document.getElementById(username)
    if (li) {
        li.remove()
    }
})

socket.on('new game', state => {    
    const boardCards = Array.from(board.children)
    boardCards.forEach(x => x.setAttribute('src', 'blue.svg'))

    const children = Array.from(action_bar.children)
    while (action_bar.firstChild) {
        action_bar.removeChild(action_bar.firstChild)
    }
    if (sessionStorage.getItem('username') === state.bigBlind) {
        sessionStorage.setItem('myPosition', 'big blind')
    } else {
        sessionStorage.setItem('myPosition', 'button')
    }
    displayBets(state)
})

socket.on('update', state => {
    console.log(state)
    displayBets(state)
})

socket.on('post small blind', () => {
    if (sessionStorage.getItem('auto post') === 'true') {
        socket.emit('action', 'small blind')
        return
    }
    const options = [{label: 'post small blind', value: 'small blind'}]
    options.forEach( x => {
        const button = document.createElement('button')
        button.setAttribute('class', 'action-button')
        button.innerText = x.label
        button.betValue = x.value
        action_bar.appendChild(button)
    })
})

socket.on('post big blind', () => {
    if (sessionStorage.getItem('auto post') === 'true') {
        socket.emit('action', 'big blind')
        return
    }
    const options = [{label: 'post big blind', value: 'big blind'}]
    options.forEach( x => {
        const button = document.createElement('button')
        button.setAttribute('class', 'action-button')
        button.innerText = x.label
        button.betValue = x.value
        action_bar.appendChild(button)
    })
})

socket.on('action', options => {
    options.forEach( x => {
        const button = document.createElement('button')
        button.setAttribute('class', 'action-button')
        button.innerText = x.label
        button.betValue = x.value
        action_bar.appendChild(button)
    })
})

socket.on('call', state => {
    displayBets(state)
})

function translate(card) {
    const r = card[0]
    const s = card[1]
    let suit = null;
    let rank = null;
    switch (r) {
        case 'A': rank = 'ace'; break;
        case 'K': rank = 'king'; break;
        case 'Q': rank = 'queen'; break;
        case 'J': rank = 'jack'; break;
        case 'T': rank = '10'; break;
        default: rank = r;
    }
    switch (s) {
        case 'd': suit = 'diamonds'; break;
        case 'c': suit = 'clubs'; break;
        case 's': suit = 'spades'; break;
        case 'h': suit = 'hearts'; break;
    }
    let src = '../cards/' + suit + '_' + rank + '.svg'
    return src

}

socket.on('deal', (card, position) => {
    const img = document.getElementById(position)
    img.setAttribute('src', translate(card))
})