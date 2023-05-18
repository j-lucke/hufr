const path = require('path')
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')))

class User {
    constructor(socket, sessionID) {
        this.socket = socket
        this.sessionID = sessionID
        this.connectionStatus = 'connected'
        this.username = undefined
        this.currentGame = null
    }
}

class Game {
    constructor(bigBlindUser, buttonUser) {
        this.id = Math.floor(Math.random() * 1000000)
        // bigBlind and button are instances of User
        this.bigBlindUser = bigBlindUser
        this.buttonUser = buttonUser
        bigBlindUser.currentGame = this
        buttonUser.currentGame = this

        this.bigBlind = {
            socket: bigBlindUser.socket,
            username: bigBlindUser.username,
            stack: 1000,
            postedBlind: false,
            alreadyIn: 0
        }

        this.button = {
            socket: buttonUser.socket,
            username: buttonUser.username,
            stack: 1000,
            postedBlind: false,
            alreadyIn: 0
        }

        this.actionOn = this.button
        this.bet = undefined
        this.previousBet = undefined
        this.pot = 0
        this.street = 'preflop'
    }

    toString = function() {
        return `[${this.id}] ${this.bigBlind.username} v ${this.button.username}`
    }

    getState = function() {
        const state = {
            bigBlind: this.bigBlind.username,
            button: this.button.username,
            bigBlindStack: this.bigBlind.stack,
            buttonStack: this.button.stack,
            bigBlindAlreadyIn: this.bigBlind.alreadyIn,
            buttonAlreadyIn: this.button.alreadyIn,
            pot: this.pot
        }
        return state
    }

    nextStreet = function() {
        switch (this.street) {
            case 'preflop': this.street = 'flop'; break
            case 'flop': this.street = 'turn'; break
            case 'turn': this.street = 'river'; break
            case 'river': this.street = 'showdown'; break
            case 'showdown': this.street = 'done'; break
        }
        console.log('--- ' + this.street + ' ---')
    }

    processCall = function() {
        this.pot += 2 * this.bet
        this.bigBlind.stack -= this.bet
        this.button.stack -= this.bet
        this.previousBet = undefined
        this.bigBlind.alreadyIn = 0
        this.button.alreadyIn = 0
        this.bigBlind.socket.emit('call', this.getState())
        this.button.socket.emit('call', this.getState())
        this.nextStreet()
    }
}

const users = []

function getPlayers() {
// filters out users who are not logged in.  returns array of usernames
    const players = []
    users.forEach(x => {
        if (x.username) {
            players.push(x.username)
        }
    })
    return players
}

function createOptions(bet, leftToCall, delta, pot, stack) {
    const options = []
    
    if (bet == 0){
        options[0] = {label: 'check', value: 0}
        options[1] = {label: 'bet min' + '\n' + '20', value: 20}
        if (pot != 0) {
            options[2] = {label: 'bet pot' + '\n' + pot, value: pot}
        }
        return options
    }

    options[0] = {label: 'fold', value: undefined} 
    if (bet < stack) {
        options[1] = {label: 'call' + '\n' + leftToCall, value: bet}
    } else {
        options[1] = {label: 'all in' + '\n' + leftToCall, value: stack}
        return options
    }

    const min = bet + delta
    if (min < stack) {
        options[2] = {label: 'raise min' + '\n' + 2*delta, value: min}  
    } else {
        options[2] = {label: 'all in' + '\n' + stack, value: stack}
        return options
    }
    const newPot = 3 * bet + pot
    if (newPot == 0) {
        return options
    }
    if (newPot < stack) {
        options[3] = {label: 'bet pot' + '\n' + newPot, value: newPot}
    } else {
        options[3] = {label: 'all in' + '\n' + stack, value: stack}
    }
    return options
}

function startNewGame(game) {
    console.log('new game: ' + game.toString())
    game.bigBlind.socket.emit('new game', game.getState())
    game.bigBlind.socket.emit('post big blind')
    game.button.socket.emit('new game', game.getState())
    game.button.socket.emit('post small blind')
}

io.use( (socket, next) => {
    const sessionID = socket.handshake.auth.sessionID
    const username = socket.handshake.auth.username
    if (sessionID) {
        socket.sessionID = sessionID
        const user = users.find(x => x.sessionID == sessionID)
        if (!user) {
            // if server restarts users[] is empty but sockets are open, so...
            const newUser = new User(socket, sessionID)
            if (username) {
                newUser.username = username
            }
            users.push(newUser)
        } else {
            user.connectionStatus = 'connected'
        }
    } else {
        socket.sessionID = Math.floor(Math.random() * 1000000)
        users.push(new User(socket, socket.sessionID))
    }
    next()
})

io.on('connection', (socket) => {
    const user = users.find(x => x.sessionID == socket.sessionID)
    user.socket = socket    // session ID remains constant across reconnections, but the socket changes
    socket.emit('sessionID', socket.sessionID)
    socket.emit('players', getPlayers())

    socket.on('see users', () => {
        console.log(getPlayers())
    })

    socket.on('login', username => {
        user.username = username
        io.emit('login', username)
    })

    socket.on('logout', () => {
        io.emit('logout', user.username)
        delete user.username
    })

    socket.on('disconnect', () => {
        user.connectionStatus = 'disconnected'
        setTimeout( () => {
            if (user.connectionStatus == 'connected') {
            } else {
                const index = users.indexOf(user)
                users.splice(index, 1)
                if (user.username) {
                    io.emit('logout', user.username)
                }
            }
        }, 2000)
    })

    socket.on('challenge', challengee => {
        const opponent = users.find(x => x.username == challengee)
        const game = new Game(user, opponent)
        startNewGame(game)
    })

    socket.on('action', bet => {
        const game = user.currentGame
        game.bet = bet
        let nextToAct = null
        let nextStack = 0
        let leftToCall = 0
        if (user == game.bigBlindUser) {
            console.log('user is big blind')
            nextToAct = game.button
            nextStack = game.button.stack
            game.bigBlind.alreadyIn = bet
            leftToCall = Math.min(bet - game.button.alreadyIn, game.button.stack - game.button.alreadyIn)
        } else {
            console.log('user is button')
            nextToAct = game.bigBlind
            nextStack = game.bigBlind.stack
            game.button.alreadyIn = bet
            console.log(game.button.alreadyIn)
            leftToCall = Math.min(bet - game.bigBlind.alreadyIn, game.bigBlind.stack - game.bigBlind.alreadyIn)
        }

        game.bigBlind.socket.emit('update', game.getState())
        game.button.socket.emit('update', game.getState())

        if (bet == 'small blind') {
            console.log('small blind posted')
            game.button.postedBlind = true
            if (game.bigBlind.postedBlind) {
                game.button.socket.emit('action', createOptions(20, 10, 20, game.pot, game.button.stack))
                game.previousBet = 20
            }
            return
        }
        if (bet == 'big blind') {
            console.log('big blind posted')
            game.bigBlind.postedBlind = true
            if (game.button.postedBlind) {
                game.button.socket.emit('action', createOptions(20, 10, 20, game.pot, game.button.stack))
                game.previousBet = 20
            }
            return
        }
        if (bet == 0) {
            if (user == game.buttonUser) {
                console.log('check back')
                console.log('pot: ' + game.pot)
                game.bigBlind.socket.emit('action', createOptions(0, 0, 0, game.pot, game.bigBlind.stack))
                game.previousBet = undefined
                game.nextStreet()
                return
            }
            console.log('check')
            game.button.socket.emit('action', createOptions(0, 0, 0, game.pot, game.button.stack))
            game.previousBet = 0
            return
        }   
        if (bet == game.previousBet) {
            console.log('call ' + bet)
            console.log('pot: ' + game.pot)
            game.processCall()
            game.bigBlind.socket.emit('action', createOptions(0, 0, 0, game.pot, game.bigBlind.stack))
            return
        }
        
        if ((game.previousBet == 0) || (game.previousBet == undefined)) {
            console.log('bet ' + bet)
            game.previousBet = 0     // don't want to pass undefined to createOptions
            nextToAct.socket.emit('action', createOptions(bet, bet, bet, game.pot, nextStack))
            game.previousBet = bet
            return
        }
        // all in for less
        if (bet < game.previousBet) {
            console.log('all in for less')
            return
        }
        if (bet > game.previousBet) {
            console.log('raise to ' + bet)
            nextToAct.socket.emit('action', createOptions(bet, leftToCall, bet - game.previousBet, game.pot, nextStack))
            game.previousBet = bet
            return
        }
    })
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});