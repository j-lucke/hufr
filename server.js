const path = require('path')
const express = require('express');
const app = express();
const http = require('http');
const Hand = require('pokersolver').Hand
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')))


const SUITS = ['s', 'h', 'd', 'c']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']

let DECK = []

for (s = 0; s < 4; s++)
    for (r = 0; r < 13; r++)
        DECK.push(RANKS[r]+SUITS[s])

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function deal(deck) {
    const index = getRandomInt(deck.length)
    const card = deck[index]
    deck.splice(index, 1)
    return card
}


class User {
    constructor(socket, sessionID) {
        this.socket = socket
        this.sessionID = sessionID
        this.connectionStatus = 'connected'
        this.username = undefined
        this.opponent = null
        this.currentGame = null
        this.stack = 1000
        this.isNextButton = undefined
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
            preflopStatus: 'yet to act',
            pocket: []
        }

        this.button = {
            socket: buttonUser.socket,
            username: buttonUser.username,
            stack: buttonUser.stack,
            postedBlind: false,
            alreadyIn: 0,
            preflopStatus: 'yet to act',
            pocket: []
        }

        this.deck = DECK.slice()

        this.actionOn = this.button
        this.bet = undefined
        this.bettor = null
        this.previousBet = undefined
        this.pot = 0
        this.board = []
        this.noFurtherAction = false
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
            options[1] = {label: 'raise min!' + '\n' + '20', value: 20}
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
        if (this.bet === this.bettor.stack) {
            options[1] = {label: 'call' + '\n' + this.bet, value: this.bet}
            return options
        }
        if (this.bet < this.actionOn.stack) {
            options[1] = {label: 'call' + '\n' + leftToCall, value: this.bet}
        } else {
            leftToCall = this.actionOn.stack - this.actionOn.alreadyIn
            options[1] = {label: 'all in' + '\n' + leftToCall, value: this.actionOn.stack}
            return options
        }

        console.log('bet: ' + this.bet + '    previous: ' + this.previousBet)

        let delta = this.bet - this.previousBet
        if (facingBigBlind){
            delta = 20
        }
        const min = this.bet + delta
        if (min < this.actionOn.stack) {
            options[2] = {label: 'raise min!!' + '\n' + 2*delta, value: min}  
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
            pot: this.pot,
            bet: this.bet,
            board: this.board
        }
        return state
    }

    nextStreet = function() {
        switch (this.street) {
            case 'preflop': 
                this.street = 'flop'; 
                setTimeout( () => {
                    this.bigBlind.socket.emit('action', this.getOptions()); 
                    this.dealFlop()    
                }, 0)
                break
            case 'flop': 
                this.street = 'turn'; 
                setTimeout(() => {
                    this.bigBlind.socket.emit('action', this.getOptions()); 
                    this.dealTurn()    
                }, 0)
                break
            case 'turn': 
                this.street = 'river'; 
                setTimeout(() => {
                    this.bigBlind.socket.emit('action', this.getOptions()); 
                    this.dealRiver();    
                }, 0)
                break
            case 'river': this.street = 'showdown'; break
            case 'showdown': this.street = 'done'; break
        }
        console.log('--- ' + this.street + ' ---' + `[${this.pot}]`)
        if (this.street === 'showdown') {
            setTimeout(() => {
                this.showdown()    
                return
            }, 1000)
        }
        if (this.street === 'done') {
            this.bigBlind.socket.emit('game over', this.wrapUpMessage)
            this.button.socket.emit('game over', this.wrapUpMessage)
            this.buttonUser.currentGame = null
            this.bigBlindUser.currentGame = null
            setTimeout( () => {
                let someoneStanding = false
                if (this.bigBlindUser.status === 'standing') {
                    someoneStanding = true
                    this.button.socket.emit('stand up')
                }
                if (this.buttonUser.status === 'standing') {
                    someoneStanding = true
                    this.bigBlind.socket.emit('stand up')
                }
                if (someoneStanding) {
                    this.buttonUser.isNextButton = false
                    this.bigBlindUser.isNextButton = true
                    return
                }
                startNewGame(new Game(this.buttonUser, this.bigBlindUser))
            }, 5000)
        }
    }

    findWinner = function() {
        const buttonHand = Hand.solve(this.button.pocket.concat(this.board))
        const bigBlindHand = Hand.solve(this.bigBlind.pocket.concat(this.board))

        console.log(this.bigBlind.username + ' has ' + bigBlindHand.descr)
        console.log(this.button.username + ' has ' + buttonHand.descr)
    
        const winner = Hand.winners([buttonHand, bigBlindHand])
        const bigBlindIsWinner = (winner.toString() == bigBlindHand.toString())
        const buttonIsWinner = (winner.toString() == buttonHand.toString())
        const chop = (winner.length > 1)
        if (chop) {
            this.wrapUpMessage = 'chop, ' + buttonHand.descr
            return 'chop'
        } 
        if (bigBlindIsWinner) {
            this.wrapUpMessage = this.bigBlind.username + 'wins, with ' + bigBlindHand.descr
            return 'big blind'
        }
        if (buttonIsWinner) {
            this.wrapUpMessage = this.button.username + 'wins, with ' + buttonHand.descr
            return 'button'
        }
        return 'error' 
    }

    showdown = function() {
        const result = this.findWinner()
        if (result === 'big blind'){
            this.winner = this.bigBlind
            this.loser = this.button
        } 
        if (result === 'button') {
            this.winner = this.button
            this.loser = this.bigBlind
        }
    
        this.button.socket.emit('deal', this.bigBlind.pocket[0], 'his-pocket-1')
        this.button.socket.emit('deal', this.bigBlind.pocket[1], 'his-pocket-2')
        this.bigBlind.socket.emit('deal', this.button.pocket[0], 'his-pocket-1')
        this.bigBlind.socket.emit('deal', this.button.pocket[1], 'his-pocket-2')

        if (result !== 'chop') {
            this.winner.stack += this.pot
            console.log(this.winner.username + ' wins ' + this.pot)
            this.bigBlindUser.stack = this.bigBlind.stack
            this.buttonUser.stack = this.button.stack
            console.log(this.bigBlindUser.stack, this.buttonUser.stack)
        } else {
            this.bigBlind.stack += this.pot/2
            this.button.stack += this.pot/2
            this.bigBlindUser.stack = this.bigBlind.stack
            this.buttonUser.stack = this.button.stack
            console.log('chop')
            console.log(this.bigBlindUser.stack, this.buttonUser.stack)
        }
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
        this.actionOn = this.bigBlind
        setTimeout( () => {
            if (this.noFurtherAction) {
                this.runToShowdown()
            } else {
                this.nextStreet()
            }    
            this.bigBlind.socket.emit('update', this.getState())
            this.button.socket.emit('update', this.getState())    
        }, 1000)
    }

    runToShowdown = function() {
        let delay = 0
        switch(this.street) {
            case 'preflop': 
                delay += 1000
                setTimeout(() => {
                    this.street = 'flop' 
                    this.dealFlop()
                    console.log('--- flop ---')
                    console.log('no action')    
                }, delay)
            case 'flop': 
                delay += 1000
                setTimeout( () => {
                    this.street = 'turn' 
                    this.dealTurn()
                    console.log('--- turn ---')
                    console.log('no action')
                }, delay)
            case 'turn': 
                delay += 1000
                setTimeout( () => {
                    this.street = 'river'; 
                    this.dealRiver();
                    console.log('--- river ---')
                    console.log('no action')
                }, delay)
            case 'river': 
                delay += 1000
                setTimeout( () => {
                    this.street = 'done' 
                    this.showdown()
                }, delay) 
        }
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

        this.winner.socket.emit('fold')

        this.street = 'done'
        this.bigBlind.alreadyIn = 0
        this.button.alreadyIn = 0
        this.pot = 0

        this.bigBlindUser.stack = this.bigBlind.stack
        this.buttonUser.stack = this.button.stack

        this.bigBlindUser.currentGame = null
        this.buttonUser.currentGame = null

        this.bigBlindUser.socket.emit('game over', 'somebody folded')
        this.buttonUser.socket.emit('game over', 'somebody folded')
        
        setTimeout( () => {
            let someoneStanding = false
            if (this.bigBlindUser.status === 'standing') {
                someoneStanding = true
                this.button.socket.emit('stand up')
            }
            if (this.buttonUser.status === 'standing') {
                someoneStanding = true
                this.bigBlind.socket.emit('stand up')
            }
            if (someoneStanding) {
                this.buttonUser.isNextButton = false
                this.bigBlindUser.isNextButton = true
                return
            }
            startNewGame(new Game(this.buttonUser, this.bigBlindUser))
        }, 1000)
    }

    dealHoleCards = function() {
        this.button.pocket.push(deal(this.deck))
        this.button.pocket.push(deal(this.deck))
        this.bigBlind.pocket.push(deal(this.deck))
        this.bigBlind.pocket.push(deal(this.deck))

        this.button.socket.emit('deal', this.button.pocket[0], 'my-pocket-1')
        this.button.socket.emit('deal', this.button.pocket[1], 'my-pocket-2')
        this.bigBlind.socket.emit('deal', this.bigBlind.pocket[0], 'my-pocket-1')
        this.bigBlind.socket.emit('deal', this.bigBlind.pocket[1], 'my-pocket-2')
    }

    dealFlop = function() {
        this.board.push(deal(this.deck))
        this.board.push(deal(this.deck))
        this.board.push(deal(this.deck))

        this.button.socket.emit('deal', this.board[0], 'board-1')
        this.bigBlind.socket.emit('deal', this.board[0], 'board-1')
        this.button.socket.emit('deal', this.board[1], 'board-2')
        this.bigBlind.socket.emit('deal', this.board[1], 'board-2')
        this.button.socket.emit('deal', this.board[2], 'board-3')
        this.bigBlind.socket.emit('deal', this.board[2], 'board-3')

    }

    dealTurn = function() {
        this.board.push(deal(this.deck))
        this.bigBlind.socket.emit('deal', this.board[3], 'board-4')
        this.button.socket.emit('deal', this.board[3], 'board-4')
    }

    dealRiver = function() {
        this.board.push(deal(this.deck))
        this.bigBlind.socket.emit('deal', this.board[4], 'board-5')
        this.button.socket.emit('deal', this.board[4], 'board-5')

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
    if (game.bigBlind.stack < 20) {
        game.bigBlind.socket.emit('rebuy', game.getState())
        return
    }
    if (game.button.stack < 20) {
        game.button.socket.emit('rebuy', game.getState())
        return
    }
    console.log('\n' + '\n')
    console.log('new game: ' + game.toString())
    game.bigBlind.socket.emit('new game', game.getState())
    game.button.socket.emit('new game', game.getState())
    game.bigBlind.socket.emit('post big blind')
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
        user.status = 'in lobby'
        io.emit('login', username)
    })

    socket.on('sit down', () => {
        user.status = 'sitting'
        user.opponent.socket.emit('sit down')
        if ((!user.currentGame) && (user.opponent.status === 'sitting')){
            let game = null
            if (user.isNextButton) {
                game = new Game(user.opponent, user)
            } else {
                game = new Game(user, user.opponent)
            }
            startNewGame(game)
        }
    })

    socket.on('stand up', () => {
        user.status = 'standing'
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
        if (opponent.status != 'playing') {
            opponent.socket.emit('challenge', user.username)
        } else {
            socket.emit('message', challengee + ' is busy defending his roll against someone else!')
        }
    })

    socket.on('accepted', challenger => {
        const otherDude = users.find(x => x.username === challenger)
        if (otherDude) {
            otherDude.socket.emit('accepted', user.username)
            setTimeout( () => {
                user.status = 'sitting'
                user.opponent = otherDude
                otherDude.status = 'sitting'
                otherDude.opponent = user
                game = new Game(user, otherDude)
                startNewGame(game)
            }, 3000)
        }
    })

    socket.on('declined', challenger => {
        const otherDude = users.find(x => x.username === challenger)
        if (otherDude) {
            otherDude.socket.emit('declined', user.username)
        }
    })

    socket.on('rebuy', () => {
        const game = user.currentGame
        if (user === game.bigBlindUser) {
            game.bigBlind.stack += 1000
        } else {
            game.button.stack += 1000
        }
        console.log('\n' + '\n')
        console.log(user.username + ' rebuys')
        console.log('\n' + '\n')
        console.log('new game: ' + game.toString())
        game.bigBlind.socket.emit('new game', game.getState())
        game.button.socket.emit('new game', game.getState())
        game.bigBlind.socket.emit('post big blind')
        game.button.socket.emit('post small blind')
    })

    socket.on('recover', () => {
        const game = user.currentGame
        
        console.log('recover requested by ' + user.username)
        if (!game) {
            console.log('no game')
            return
        }
        
        console.log('action is on ' + game.actionOn.username)

        if (game.bigBlind.username === user.username) {
            game.bigBlind.socket = socket
            socket.emit('deal', game.bigBlind.pocket[0], 'my-pocket-1')
            socket.emit('deal', game.bigBlind.pocket[1], 'my-pocket-2')
        } else {
            game.button.socket = socket
            socket.emit('deal', game.button.pocket[0], 'my-pocket-1')
            socket.emit('deal', game.button.pocket[1], 'my-pocket-2')

        }
        socket.emit('update', game.getState())
        let count = 1
        game.board.forEach(card => {
            socket.emit('deal', card, 'board-' + count)
            count++
        })
        if (game.actionOn.username === user.username) {
            console.log(game.getOptions())
            socket.emit('action', game.getOptions())
        }
    })

    socket.on('action', bet => {
        const game = user.currentGame
        game.previousBet = game.bet
        game.bet = bet
        let nextToAct = null
        let nextStack = 0
        let leftToCall = 0
        if (user == game.bigBlindUser) {
            game.bettor = game.bigBlind
            nextToAct = game.button
            nextStack = game.button.stack
            if (bet !== null) {
                game.bigBlind.alreadyIn = bet
            }
        } else {
            game.bettor = game.button
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
            if (game.bigBlind.postedBlind && game.button.postedBlind) {
                game.dealHoleCards()
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
            if (game.button.postedBlind && game.bigBlind.postedBlind) {
                game.dealHoleCards()
                game.bet = 'big blind'
                console.log('--- preflop ---')
                game.button.socket.emit('action', game.getOptions())
                game.previousBet = 20
            }
            return
        }
        if (bet === 0) {
            user.socket.emit('check', 'me')
            nextToAct.socket.emit('check', 'him')
            if (user == game.buttonUser) {
                console.log('check back')
                /*
                game.actionOn = game.bigBlind
                game.previousBet = undefined
                game.nextStreet()
                */
                game.processCall()
                return
            }
            console.log('check')
            game.actionOn = game.button
            game.actionOn.socket.emit('action', game.getOptions())
            game.previousBet = 0
            return
        }   
        if (bet === game.previousBet) {
            if ((bet === game.bigBlind.stack) || (bet === game.button.stack)) {
                game.noFurtherAction = true
            }
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
           // game.previousBet = bet
            return
        }
        // all in for less
        if (bet < game.previousBet) {
            console.log('all in for less')
            game.noFurtherAction = true
            game.processCall()
            return
        }
        if (bet > game.previousBet) {
            console.log('raise to ' + bet)
            game.actionOn = nextToAct
            nextToAct.socket.emit('action', game.getOptions())
           // game.previousBet = bet
            return
        }
    })
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});