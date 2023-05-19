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
        this.stack = 1000
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
            stack: bigBlindUser.stack,
            postedBlind: false,
            alreadyIn: 0,
            hasOption: true,
            preflopStatus: 'yet to act'
        }

        this.button = {
            socket: buttonUser.socket,
            username: buttonUser.username,
            stack: buttonUser.stack,
            postedBlind: false,
            alreadyIn: 0,
            preflopStatus: 'yet to act'
        }

        this.actionOn = this.button
        this.bet = undefined
        this.previousBet = undefined
        this.pot = 0
        this.street = 'preflop'
        this.winner = null
        this.loser = null
    }

    toString = function() {
        return `[${this.id}] ${this.bigBlind.username} v ${this.button.username}`
    }

    getOptions = function() {
        const options = []

        let facingBigBlind = false
        if (this.bet === 'big blind') {
            facingBigBlind = true
            this.bet = 20
        }

        if (this.bet === 0){
            options[0] = {label: 'check', value: 0}
            options[1] = {label: 'bet min' + '\n' + '20', value: 20}
            if (this.pot !== 0) {
                if (this.actionOn.stack > this.pot) {
                    options[2] = {label: 'bet pot' + '\n' + this.pot, value: this.pot}
                } else {
                    options[2] = {label: 'all in' + '\n' + this.actionOn.stack, value: this.actionOn.stack}
                }
            }
            return options
        }

        let leftToCall = this.bet - this.actionOn.alreadyIn
        if (leftToCall === 0) {
            options[0] = {label: 'check', value: 20}
            options[1] = {label: 'raise min' + '\n' + '20', value: 20}
            const newPot = 3 * this.bet + this.pot
            if (newPot === 0) {
                return options
            }
            if (newPot < this.actionOn.stack) {
                options[2] = {label: 'bet pot' + '\n' + newPot, value: newPot}
            } else {
                options[2] = {label: 'all in' + '\n' + this.actionOn.stack, value: this.actionOn.stack}
            }
            return options
        } 

        options[0] = {label: 'fold', value: undefined}
        if (this.bet < this.actionOn.stack) {
            options[1] = {label: 'call' + '\n' + leftToCall, value: this.bet}
        } else {
            leftToCall = this.actionOn.stack - this.actionOn.alreadyIn
            options[1] = {label: 'all in' + '\n' + leftToCall, value: this.actionOn.stack}
            return options
        }

        let delta = this.bet - this.previousBet
        if (facingBigBlind){
            delta = 20
        }
        const min = this.bet + delta
        if (min < this.actionOn.stack) {
            options[2] = {label: 'raise min' + '\n' + 2*delta, value: min}  
        } else {
            options[2] = {label: 'all in' + '\n' + this.actionOn.stack, value: this.actionOn.stack}
            return options
        }

        const newPot = 3 * this.bet + this.pot
        if (newPot === 0) {
            return options
        }
        if (newPot < this.actionOn.stack) {
            options[3] = {label: 'bet pot' + '\n' + newPot, value: newPot}
        } else {
            options[3] = {label: 'all in' + '\n' + this.actionOn.stack, value: this.actionOn.stack}
        }
        return options
    

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
            case 'preflop': this.street = 'flop'; this.bigBlind.socket.emit('action', this.getOptions()); break
            case 'flop': this.street = 'turn'; this.bigBlind.socket.emit('action', this.getOptions()); break
            case 'turn': this.street = 'river'; this.bigBlind.socket.emit('action', this.getOptions()); break
            case 'river': this.street = 'showdown'; break
            case 'showdown': this.street = 'done'; break
        }
        console.log('--- ' + this.street + ' ---' + `[${this.pot}]`)
        if (this.street === 'showdown') {
            this.showdown()    
        }
        if (this.street === 'done') {
            startNewGame(new Game(this.buttonUser, this.bigBlindUser))
        }
    }

    showdown = function() {
        const rand = Math.random()
        console.log(rand)
        if (rand < 0.5){
            this.winner = this.bigBlind
            this.loser = this.button
        } else {
            this.winner = this.button
            this.loser = this.bigBlind
        }
        this.winner.stack += this.pot
        console.log(this.winner.username + ' wins ' + this.pot)
        this.bigBlindUser.stack = this.bigBlind.stack
        this.buttonUser.stack = this.button.stack
        console.log(this.bigBlindUser.stack, this.buttonUser.stack)
        this.bigBlind.socket.emit('update', this.getState())
        this.button.socket.emit('update', this.getState())
        this.nextStreet()
    }

    processCall = function() {
        this.pot += 2 * this.bet
        this.bigBlind.stack -= this.bet 
        this.button.stack -= this.bet 
        this.previousBet = undefined
        this.bigBlind.alreadyIn = 0
        this.button.alreadyIn = 0
        this.bet = 0
        this.bigBlind.socket.emit('call', this.getState())
        this.button.socket.emit('call', this.getState())
        this.nextStreet()
    }

    processFold = function(){
        const abandonedBet = this.actionOn.alreadyIn
        this.pot += 2 * abandonedBet
        this.bigBlind.stack -= abandonedBet
        this.button.stack -= abandonedBet
    
        if (this.actionOn === this.bigBlind){
            this.winner = this.button
            this.loser = this.bigBlind
        } else {
            this.winner = this.bigBlind
            this.loser = this.button
        }
        console.log(this.winner.username + ' wins ' + this.pot)
        this.winner.stack += this.pot
        console.log(this.bigBlind.stack, this.button.stack)

        this.street = 'done'
        this.bigBlind.alreadyIn = 0
        this.button.alreadyIn = 0
        this.pot = 0
        this.bigBlind.socket.emit('update', this.getState())
        this.button.socket.emit('update', this.getState())

        this.bigBlindUser.stack = this.bigBlind.stack
        this.buttonUser.stack = this.button.stack
        startNewGame(new Game(this.buttonUser, this.bigBlindUser))
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
            nextToAct = game.button
            nextStack = game.button.stack
            if (bet !== null) {
                game.bigBlind.alreadyIn = bet
            }
        } else {
            nextToAct = game.bigBlind
            nextStack = game.bigBlind.stack
            if (bet !== null) {
                game.button.alreadyIn = bet
            }
        }

        game.bigBlind.socket.emit('update', game.getState())
        game.button.socket.emit('update', game.getState())

        
        if (bet === null) {
            console.log('fold')
            game.processFold()
            return
        }
        if (bet === 'small blind') {
            console.log('small blind posted')
            game.button.postedBlind = true
            game.button.alreadyIn = 10
            game.bigBlind.socket.emit('update', game.getState())
            game.button.socket.emit('update', game.getState())
            if (game.bigBlind.postedBlind) {
                game.bet = 'big blind'
                console.log('--- preflop ---')
                game.button.socket.emit('action', game.getOptions())
                game.previousBet = 20
            }
            return
        }
        if (bet === 'big blind') {
            console.log('big blind posted')
            game.bigBlind.postedBlind = true
            game.bigBlind.alreadyIn = 20
            game.bigBlind.socket.emit('update', game.getState())
            game.button.socket.emit('update', game.getState())
            if (game.button.postedBlind) {
                game.bet = 'big blind'
                console.log('--- preflop ---')
                game.button.socket.emit('action', game.getOptions())
                game.previousBet = 20
            }
            return
        }
        if (bet === 0) {
            if (user == game.buttonUser) {
                console.log('check back')
                game.actionOn = game.bigBlind
                game.previousBet = undefined
                game.nextStreet()
                return
            }
            console.log('check')
            game.actionOn = game.button
            game.actionOn.socket.emit('action', game.getOptions())
            game.previousBet = 0
            return
        }   
        if (bet === game.previousBet) {
            if (bet > 20) {
                game.bigBlind.hasOption = false
            }
            console.log('call ' + bet)
            if (!game.bigBlind.hasOption) {
                game.processCall()
                return
            } else {
                game.bigBlind.hasOption = false
            }
            game.actionOn = game.bigBlind
            game.actionOn.socket.emit('action', game.getOptions())
            return
        }
        
        if ((game.previousBet === 0) || (game.previousBet == undefined)) {
            console.log('bet ' + bet)
            game.previousBet = 0     // don't want to pass undefined to createOptions
            game.actionOn = nextToAct
            nextToAct.socket.emit('action', game.getOptions())
            game.previousBet = bet
            return
        }
        // all in for less
        if (bet < game.previousBet) {
            console.log('all in for less')
            game.processCall()
            return
        }
        if (bet > game.previousBet) {
            console.log('raise to ' + bet)
            game.actionOn = nextToAct
            nextToAct.socket.emit('action', game.getOptions())
            game.previousBet = bet
            return
        }
    })
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});