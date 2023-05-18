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
    const children = Array.from(action_bar.children)
    while (action_bar.firstChild) {
        action_bar.removeChild(action_bar.firstChild)
    }
    displayBets(state)
    /*
    let hisName = ''
    let hisStack = 0
    if (state.bigBlind == sessionStorage.getItem('username')) {
        hisName = state.button
        hisStack = state.buttonStack
        sessionStorage.setItem('myPosition', 'big blind')
    } else {
        hisName = state.bigBlind
        hisStack = state.bigBlindStack
        sessionStorage.setItem('myPosition', 'button')
    }
    his_name_plate.innerText = hisName + '\n' + hisStack
    */
})

socket.on('update', state => {
    console.log(state)
    displayBets(state)
})

socket.on('post small blind', () => {
    const options = [{label: 'post small blind', value: 'small blind'}]
    options.forEach( x => {
        const button = document.createElement('button')
        button.setAttribute('class', 'action-button')
        button.innerText = x.label
        button.betValue = x.value
        action_bar.appendChild(button)
    })
    sessionStorage.setItem('myPosition', 'button')
})

socket.on('post big blind', () => {
    const options = [{label: 'post big blind', value: 'big blind'}]
    options.forEach( x => {
        const button = document.createElement('button')
        button.setAttribute('class', 'action-button')
        button.innerText = x.label
        button.betValue = x.value
        action_bar.appendChild(button)
    })
    sessionStorage.setItem('myPosition', 'big blind')
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