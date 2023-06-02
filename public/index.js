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



const body = document.querySelector('body')
const lobby_list = document.getElementById('lobby-list')
const login_button = document.getElementById('login-button')
const quit_button = document.getElementById('quit-button')
const action_bar = document.getElementById('action-bar')
const options_bar = document.getElementById('options-bar')
const his_name_plate = document.getElementById('his-name-plate')
const my_name_plate = document.getElementById('my-name-plate')
const my_chip = document.getElementById('my-chip')
const his_chip = document.getElementById('his-chip')
const pot_chip = document.getElementById('pot-chip')
const dealerButton = document.getElementById('button')
const sit_out = document.getElementById('sit-out')
const auto_post = document.getElementById('auto-post')
const auto_muck = document.getElementById('auto-muck')
const my_pocket_1 = document.getElementById('my-pocket-1')
const my_pocket_2 = document.getElementById('my-pocket-2')
const his_pocket = document.getElementById('his-pocket')
const his_pocket_1 = document.getElementById('his-pocket-1')
const his_pocket_2 = document.getElementById('his-pocket-2')
const board = document.getElementById('board')
const board_1 = document.getElementById('board-1')
const board_2 = document.getElementById('board-2')
const board_3 = document.getElementById('board-3')
const board_4 = document.getElementById('board-4')
const board_5 = document.getElementById('board-5')



let loggedIn = false
if (sessionStorage.getItem('username')) {
    login_button.innerText = sessionStorage.getItem('username')
    loggedIn = true
    socket.emit('recover')
}
if (sessionStorage.getItem('auto post') === 'true') {
    auto_post.children[0].style.backgroundColor = 'aqua'
} else {
    sessionStorage.setItem('auto post', 'false')
}
if (sessionStorage.getItem('sit out') === 'true') {
    sit_out.children[0].style.backgroundColor = 'aqua'
} else {
    sessionStorage.setItem('sit out', 'false')
}

const gameState = null

const my = {
    name: sessionStorage.getItem('username'),
    stack: undefined,
    alreadyIn: undefined,
    status: undefined
}

const his = {
    name: undefined,
    stack: undefined,
    alreadyIn: undefined,
    status: undefined
}

let bet = undefined
let facing = undefined
let pot = undefined


function getCustomBet(event) {
    let isValid = true
    if (event.key === 'Enter') {
        let customBet = parseInt(event.target.value)
        if (isNaN(customBet)) {
            return
        }
        console.log(facing)
        if (!facing && customBet < 40) {
        // facing big blind
            return
        }
        if (customBet < 2*facing) {
            console.log('too small')
            return
        }
        if (customBet - my.alreadyIn > my.stack) {
            console.log('too big')
            return
        }
        socket.emit('action', customBet)
        while (action_bar.firstChild) {
            action_bar.removeChild(action_bar.firstChild)
        }
    }
}

function customBetButton() {
    const button = document.createElement('button')
    button.setAttribute('class', 'action-button')
    button.setAttribute('id', 'bet-input-button')
    button.innerText = 'enter bet'
    const input = document.createElement('input')
    input.setAttribute('id', 'bet-input')
    input.setAttribute('type', 'text')
    input.setAttribute('name', 'customBet')
    button.appendChild(input)
    input.addEventListener('keyup', getCustomBet)
    return button
}

function parseState(state) {
    console.log(state)
    if (sessionStorage.getItem('myPosition') === 'big blind') {
        my.name = state.bigBlind
        my.stack = state.bigBlindStack
        my.alreadyIn = state.bigBlindAlreadyIn
        his.name = state.button
        his.stack = state.buttonStack
        his.alreadyIn = state.buttonAlreadyIn
    } else {
        his.name = state.bigBlind
        his.stack = state.bigBlindStack
        his.alreadyIn = state.bigBlindAlreadyIn
        my.name = state.button
        my.stack = state.buttonStack
        my.alreadyIn = state.buttonAlreadyIn
    }
    pot = state.pot
    bet = state.bet
    facing = state.facing
}

function displayMy() {
    if (parseInt(my.alreadyIn) > 0) {
        my_chip.innerText = my.alreadyIn
        my_chip.style.display = 'block'
        my_name_plate.innerText = my.name + '\n' + (my.stack - my.alreadyIn)
    } else {
        my_name_plate.innerText = my.name + '\n' + my.stack
    }
}

function displayHis() {
    if (parseInt(his.alreadyIn) > 0) {
        his_chip.innerText = his.alreadyIn
        his_chip.style.display = 'block'
        his_name_plate.innerText = his.name + '\n' + (his.stack - his.alreadyIn)
    } else {
        his_name_plate.innerText = his.name + '\n' + his.stack
    }
    //to recover his cards after reconnection
}

function displayPot() {
    if (parseInt(pot) > 0) {
        pot_chip.innerText = pot
        pot_chip.style.display = 'block'
    } else {
        pot_chip.style.display = 'none'
    }
}

function display() {
    displayMy()
    displayHis()
}

function messageBox(text, ...options) {
    const box = document.createElement('div')
    box.setAttribute('class', 'message-box')
    box.innerText = text
    count = 0
    options.forEach(x => {
        const button = document.createElement('button')
        button.innerText = options[count++]
        box.appendChild(button)
    })
    return box
}

function clearGamescreen() {
    console.log('clear')
    options_bar.style.display = 'none'
    his_pocket_1.style.display = 'none'
    his_pocket_2.style.display = 'none'
    my_pocket_1.style.display = 'none'
    my_pocket_2.style.display = 'none'
    his_name_plate.style.display = 'none'
    my_name_plate.style.display = 'none'
    my_chip.style.display = 'none'
    his_chip.style.display = 'none'
    pot_chip.style.display = 'none'
    quit_button.style.display = 'none'
    while (action_bar.firstChild) {
        action_bar.removeChild(action_bar.firstChild)
    }
}


function startMatch(me, him) {
    options_bar.style.display = 'flex'
    his_name_plate.style.display = 'flex'
    my_name_plate.style.display = 'flex'
    quit_button.style.display = 'block'
    his.name = him.name
    his.stack = him.stack
    my.name = me.name
    my.stack = me.stack
    displayMy()
    displayHis()
}



login_button.addEventListener('click', () => {
    if (login_button.innerText == 'login') {
        const username = prompt('choose a screen name')
        if (username) {
            socket.emit('login', username)
            loggedIn = true
            sessionStorage.setItem('username', username)
        }
        login_button.innerText = username
    } else {
        sessionStorage.removeItem('username')
        socket.emit('logout')
        loggedIn = false
        login_button.innerText= 'login'
    }
})

quit_button.addEventListener('click', ()=> {
    quit_button.disabled = true
    const box = messageBox('Really? Quit the match??', 'yes', 'no')
    gamescreen.appendChild(box)
    box.addEventListener('click', (event) => {
        if (event.target === box.children[0]) {
            box.remove()
            quit_button.disabled = false
            socket.emit('quit')
            sessionStorage.setItem('status', 'in lobby')
            clearGamescreen()
        }
        if (event.target === box.children[1]) {
            box.remove()
            quit_button.disabled = false
        }
    })
})

lobby_list.addEventListener('click', (event) => {
    if (!loggedIn) {
        const box = messageBox('you must be logged in to issue a challenge', 'OK')
        gamescreen.appendChild(box)
        box.addEventListener('click', (event) => {
            if (event.target === box.children[0]) {
                box.remove()
            }
        })
        return
    }
    const children = Array.from(lobby_list.children)
    if (children.includes(event.target)) {
        const challengee = event.target.innerText.split(' ')[0]
        socket.emit('challenge', challengee)
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
        auto_post.children[0].style.backgroundColor = 'aqua'
    } else {
        sessionStorage.setItem('auto post', 'false')
        auto_post.children[0].style.backgroundColor = 'white'
    }
})

sit_out.addEventListener('click', () => {
    if (sessionStorage.getItem('sit out') === 'false') {
        sessionStorage.setItem('sit out', 'true')
        sit_out.children[0].style.backgroundColor = 'aqua'
        socket.emit('stand up')
    } else {
        sessionStorage.setItem('sit out', 'false')
        sit_out.children[0].style.backgroundColor = 'white'
        socket.emit('sit down')
    }
})

socket.on('message', message => {
    const box = messageBox(message, 'OK')
    gamescreen.appendChild(box)
    box.addEventListener('click', (event) => {
        if (event.target === box.children[0]) {
            box.remove()
        }
    })
})

socket.on('sessionID', sessionID => {
    sessionStorage.setItem('sessionID', sessionID)
})

socket.on('players', players => {
    while (lobby_list.firstChild) {
        lobby_list.removeChild(lobby_list.firstChild)
    }
    players.forEach( x => {
        if (x.name !== sessionStorage.getItem('username')) {
            const li = document.createElement('li')
            li.setAttribute('id', x.name)
            li.innerText = `${x.name} . . . . .       ${x.status}`
            if (x.status === 'in lobby') {
                li.innerText += ` [${x.stack}]`
            }
            lobby_list.appendChild(li)
        }
    })
})

socket.on('login', (user) => {
    if (user.name == sessionStorage.getItem('username')) {
        return
    }
    const li = document.createElement('li')
    li.setAttribute('id', user.name)
    li.innerText = `${user.name} . . . . .     ${user.status}`
    if (user.status === 'in lobby') {
        li.innerText += ` [${user.stack}]`
    }

    lobby_list.appendChild(li)
})

socket.on('logout', username => {
    const li = document.getElementById(username)
    if (li) {
        li.remove()
    }
})

socket.on('lobby update', player => {
    const li = document.getElementById(player.name)
    let str = `${player.name} . . . . .       ${player.status}`
    if (player.status === 'in lobby') {
        str += ` [${player.stack}]`
    }
    li.innerText = str
})

socket.on('challenge', challenger => {
    console.log('challenge!!!')
    const div = document.createElement('div')
    div.setAttribute('class', 'message-box')
    div.innerText = challenger + ' has challenged you to play heads up for rolls'
    console.log(div)
    const button1 = document.createElement('button')
    const button2 = document.createElement('button')
    button1.innerText = 'accept'
    button2.innerText = 'decline'
    div.appendChild(button1)
    div.appendChild(button2)
    body.appendChild(div)
    console.log(body)

    div.addEventListener('click', (event) => {
        if (event.target === button1) {
            socket.emit('accepted', challenger)
        } 
        if (event.target === button2) {
            socket.emit('declined', challenger)
        }
        div.remove()
    })
})

socket.on('accepted', challengee => {
})

socket.on('declined', challengee => {
    const box = messageBox(challengee + ' has declined your challenge.', 'OK')
    gamescreen.appendChild(box)
    box.addEventListener('click', (event) => {
        if (event.target === box.children[0]) {
            box.remove()
        }
    })
})

socket.on('quit', () => {
    const box = messageBox(his.name + ' has quit the match.', 'OK')
    gamescreen.appendChild(box)
    box.addEventListener('click', (event) => {
        if (event.target === box.children[0]) {
            box.remove()
        }
    })

    sessionStorage.setItem('status', 'in lobby')
    clearGamescreen()
})

socket.on('new match', (me, him) => {
    startMatch(me, him)
})

socket.on('new game', state => {    
    console.log('new game')
    sessionStorage.setItem('status', 'playing')
    my_pocket_1.style.display = 'none'
    my_pocket_2.style.display = 'none'
    his_pocket_1.style.display = 'none'
    his_pocket_2.style.display = 'none'
    const boardCards = Array.from(board.children)
    boardCards.forEach(x => x.style.display = 'none')
    his_pocket_1.setAttribute('src', 'blue.svg')
    his_pocket_2.setAttribute('src', 'blue.svg')
    while (action_bar.firstChild) {
        action_bar.removeChild(action_bar.firstChild)
    }
    if (sessionStorage.getItem('username') === state.bigBlind) {
        sessionStorage.setItem('myPosition', 'big blind')
        dealerButton.setAttribute('class', 'his-button')
    } else {
        sessionStorage.setItem('myPosition', 'button')
        dealerButton.setAttribute('class', 'my-button')
    }
    parseState(state)
    //display()
})

socket.on('update', state => {
    console.log('update')

    if (sessionStorage.getItem('username') === state.bigBlind) {
        sessionStorage.setItem('myPosition', 'big blind')
        dealerButton.setAttribute('class', 'his-button')
    } else {
        sessionStorage.setItem('myPosition', 'button')
        dealerButton.setAttribute('class', 'my-button')
    }

    // for recovery
    his_name_plate.style.display = 'flex'
    my_name_plate.style.display = 'flex'
    quit_button.style.display = 'block'

    parseState(state)
    display()
})

socket.on('sit down', () => {
    his_name_plate.innerText = his.name + '\n' + his.stack
})

socket.on('stand up', () => {
    his_name_plate.innerText = his.name + '\n' + 'sitting out'
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
    action_bar.appendChild(customBetButton())
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

socket.on('deal', cards => {
    //why not just set display to none straight away?
    //because of the blinds!
    if (his.alreadyIn === 0) {
        his_chip.style.display = 'none'
    }
    if (my.alreadyIn === 0) {
        my_chip.style.display = 'none'
    }
    if (cards[0].position.includes('my')) {
        his_pocket_1.style.display = 'block'
        his_pocket_2.style.display = 'block'
    }
    cards.forEach( x => {
        console.log(x)
        const img = document.getElementById(x.position)
        img.setAttribute('src', translate(x.card))
        img.style.display = 'block'
    })
})

socket.on('rebuy', (state) => {
    while (action_bar.firstChild) {
        action_bar.removeChild(action_bar.firstChild)
    }
    const button = document.createElement('button')
    button.innerText = 'click to rebuy'
    button.setAttribute('class', 'action-button')
    action_bar.appendChild(button)
    button.addEventListener('click', function tempListener() {
        socket.emit('rebuy', state)
        button.remove()
    })
})

socket.on('game over', (message, state) => {
    console.log('game over')
    parseState(state)
    sessionStorage.setItem('status', 'waiting')
    while (action_bar.firstChild) {
        action_bar.removeChild(action_bar.firstChild)
    }
    action_bar.innerText = message
    my_chip.style.display = 'none'
    his_chip.style.display = 'none'
    console.log(my_chip.style.display)
})

socket.on('fold', () => {
    his_chip.innerText = 'fold'
    console.log('fold')
})

socket.on('check', (whoChecked) => {
    if (whoChecked === 'him') {
        his_chip.innerText = 'check'
        his_chip.style.display ='block'
    } else {
        my_chip.innerText = 'check'
        my_chip.style.display = 'block'
    }
})

socket.on('call', (newPotSize, newBetSize) => {
    console.log('call')
    if (pot === newPotSize) {  //check check and check-chip doesn't need to be put in pot
        return
    }
    //if caller is all in for less ... don't make it look like the big stack is being ripped off
    my.alreadyIn = newBetSize
    his.alreadyIn = newBetSize
    display()
    my_chip.style.transition = 'transform 1s'
    his_chip.style.transition = 'transform 1s'
    my_chip.style.transform = `translateY(-105px)`
    my_chip.style.transform += `translateX(185px)`
    his_chip.style.transform = 'translateY(108px)'
    his_chip.style.transform += 'translateX(185px)'
    setTimeout( () => {
        my_chip.style.transition = 'transform 0s'
        his_chip.style.transition = 'transform 0s'
        my_chip.style.transform = 'translate(0px, 0px)'
        his_chip.style.transform = 'translate(0px, 0px)'
        my_chip.style.display = 'none'
        his_chip.style.display= 'none'
        pot = newPotSize
        displayPot()
    }, 1000)
})

socket.on('you win', (finalPot) => {
    console.log('you win')
    pot_chip.style.display = 'block'
    pot_chip.style.transition = 'transform 1s'
    pot_chip.style.transform = 'translate(-185px, 105px)'
    setTimeout( () => {
        pot_chip.style.transition = 'transform 0s'
        pot_chip.style.transform = 'translate(0px, 0px)'
        pot_chip.style.display = 'none'
        console.log(my)
        console.log(his)
        display()
    }, 1000)
})

socket.on('you lose', (finalPot) => {
    console.log('you lose')
    pot_chip.style.display = 'block'
    pot_chip.style.transition = 'transform 1s'
    pot_chip.style.transform = 'translate(-185px, -108px)'
    setTimeout( () => {
        pot_chip.style.transition = 'transform 0s'
        pot_chip.style.transform = 'translate(0px, 0px)'
        pot_chip.style.display = 'none'
        display()
    }, 1000)
})

