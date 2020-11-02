import { interval, fromEvent, from, zip } from 'rxjs'
import { map, scan, filter, merge, flatMap, take, concat, takeUntil, repeatWhen, last} from 'rxjs/operators'
import { createBuilderStatusReporter } from 'typescript';
import {ConsList,List,cons} from './cons';

function pong() {
  //game constants
  const 
  Constants = new class {
    readonly CanvasSize:number = 600;
    readonly StartTime: number = 0;
    readonly MaxLevel = 10;
    //score before level change
    readonly MaxScore: number= 3;
  }

  /**
   * Takes in a take and updates the DOM to display all bodies on the SVG canvas. 
   * The only non-pure function, the only interactions it makes are with the DOM. Nothing about the states or subscriptions
   * are changed.
   * @param state - The state to update the HTML Direct Object Model.
   */
  const updateView = (state:State): void => {
    /**
      * as getting a collection of elements by classname returns a html collection, there isnt an impoerative way to iterate through each one
      * here I have defined a method for recursivley applying a function to each dom element of a certain class
     */
    const forEachDom = <T>(h:HTMLCollectionOf<Element>)=>(f: (x: Element,index:number)=> void) => (index=0):void =>  {
      if (index<h.length){
      f(h[index],index);
    
      forEachDom(h)(f)(index+1);
      }
    }
    /**
     * Takes an element and an object and applies each value to the attribute of the element in the DOM
     * @param e - element in the dom to be changed
     * @param o - object containing key value pairs
     */
    const attr = (e:Element,o:Object) =>Object.keys(o).forEach(key=>e.setAttribute(key,String(o[key])));
      
    /**
     * Adds the bodies to the SVG canvas. Iterates over the bots, ball, and players to update their attributes to match the state.
     * @param s - State to base the changes off of
     */
    const addBodies = (s: State): void => { 
      const svg = document.getElementById("canvas")!
      /**
       * Adds a single body to the svg.
       * @param classname - name of the class for the body to be added
       */
      const addBody= (classname:string)=>(b:Body)=>{
        const bot = document.createElementNS(svg.namespaceURI, 'rect')
        attr(bot,{height:b.height,width:b.width,x:0,y:0,class:classname,transform:`translate(${b.pos.x},${b.pos.y})`})
        svg.appendChild(bot)
      }
      // due to the nature of the dom the bodies need to be cleared twice
      clearBodies('player')
      clearBodies('bot')
      s.players.forEach(addBody('player'))
      s.bots.forEach(addBody('bot'))
    } 
    /**
     * Clears the current bodies on the svg canvas, other than the ball. In the future if we wanted multiple balls could add ball to this
     * @param classname 
     */
    const clearBodies = (classname:string): void=>{
      let c=document.getElementById('canvas')
      forEachDom(document.getElementsByClassName(classname))((elem,i)=>c.removeChild(elem))(0)
    }
    
    //resets the canvas at the start of each level
    if (state.time==2){
      clearBodies('player')
      clearBodies('bot')
      addBodies(state)
    }
  
    /**
     * transforms an element in the dom array to match the states
     * @param dom 
     */
    const transDOMCollection =(dom:HTMLCollectionOf<Element>)=> (b:Body,i:number):void => 
          {if (i<dom.length) attr(dom[i],{transform:`translate(${b.pos.x},${b.pos.y})`})};
    
    //Translate the bot and player paddles 
    state.players.forEach(transDOMCollection(document.getElementsByClassName('player')))
    state.bots.forEach(transDOMCollection(document.getElementsByClassName('bot')))
    
    //Transform the ball
    attr(document.getElementById("ball")!, {'transform':
    `translate(${state.ball.pos.x},${state.ball.pos.y})`}) 
    //Change the score message
    const score=document.getElementById('score')
    score.innerHTML =(state.scoreMessage)

    //Change the canvas message
    const canvastext = document.getElementById('canvastext')
    canvastext.innerHTML=state.canvasMessage

    //creates pretty circles for the level count. Uses a yuck for loop but theres no for each implmentation on dom element arrays

    forEachDom(document.getElementsByClassName('circle'))((elem,i)=> attr(elem,{style:i<=state.level?'background-color: lime':'background-color: rgb(41, 41, 36)'}))(0)
  }

  /**
   * Vector class used to calculate the poisitioning of bodies, mostly tim's code. Other than product and flipping the vecotr on it's axis
   * @author 'Arie Hendrikse', 'Tim Dwyer'
   */
  class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}
    add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y) 
    sub = (b:Vec) => this.add(b.scale(-1))
    //finds the product of two vectors
    product = (b:Vec) => new Vec(this.x*b.x,this.y*b.y)
    //flips the y-axis
    flipY = () => new Vec(this.x,-this.y)
    len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
    scale = (s:number) => new Vec(this.x*s,this.y*s)
    //flips the x-axis
    flipX = ()=> new Vec(-this.x,this.y)
    static Zero = new Vec();
  }
  /**
   * The state of the game
   */
  type State = Readonly<{
    /**
     * Time elapsed, could be used in future for expanding feature set (eg. expiring powerups or time limits etc)
     */
    time:number,
    /**
     * Cons list of player bodies in the map. Although I only have one player it allows for future expandibility if you want multiple players
     */
    players:List<Body>,
    /**
     * Cons list of bots bodies in the map. Allows for multiple bots to be maniuplated through the use of cons methods.
     */
    bots: List<Body>,
    ball:Body,
    //true for the state between rounds
    gameOver: boolean,
    //whether or not the game is paused
    paused: boolean,
    score: number,
    round: number,
    //the string to be displayed on the scoreboard
    scoreMessage: string,
    //string to be displayed over the canvas
    canvasMessage: string,
    level: number,
    //this allows for the bots versing each other while waiting for the player to start teh game
    gameStarted: boolean,
  }>
  /**
   * Body type for all the shapes that move on the canvas
   * @author 'Arie Hendrikse', 'Tim Dwyer'
   */
   type Body = Readonly<{
    //the position on the canvas
    pos: Vec,
    width: number,
    height: number,
    //the veloicity of the object
    vel:Vec,
    //How fast the body can move with each interval 
    speedFactor:Vec,
    //whether or not the shape will bounce after hitting another item
    bounces: boolean,

  }>

  /**
   * Retrieves each level state. Stored in a cons list as to use 
   * @param init - the initial state to base the levels off of
   * @param level - The level of the game
   * @return - The state at the begining of each level with their unique features
   */
  const levels = (level:number): State => {
    /**
     * The default state of the game before any player input. Contains one slow bot and a player paddle with fast movement speed
     */
    const init: State = { 
      players: new List(cons({
        pos: new Vec(30,275),
        vel: Vec.Zero,
        speedFactor:new Vec(0,1.8),
        width:10, 
        height: 50,
        bounces:false,
      },null)),
      bots:new List(cons({
        pos: new Vec(570,275),
        vel:Vec.Zero,
        speedFactor:new Vec(0,.7),
        width:10,
        height: 50,
        bounces: false,

      },null)),
      ball:{
        pos: new Vec(270,275),
        vel: new Vec(-1,0),
        speedFactor:new Vec(1,1),
        width:10, 
        height: 10,
        bounces: true,
      },
      gameStarted:false,
      time:0,
      gameOver: false,
      paused: false,
      score: 0,
      round: 0,
      canvasMessage: '',
      scoreMessage:'0 : 0',
      level:0,
    };

    //Curried higher order funciton for easy polymorphism. Applys a function to a body using the two numbers passed
    const change = (f:((x:number,y:number,b:Body)=>Body)) => (x:number) => (y:number)=>(b:Body) => f(x, y, b), //define type for function
        //Changes the speed of a body to a vector with x and y as paramters
        speedChange = change((x,y,b)=>{return {...b,speedFactor:new Vec(x,y)}}),
        //Changes the position of a body to a vector with x and y as paramters
        posChange = change((x,y,b)=>{return {...b,pos:new Vec(x,y)}}),
        //Changes the size of a body to a vector with x and y as paramters for height and width respectively
        sizeChange = change((x,y,b)=>{return {...b,width:x,height:y}})
    
    const
        //Different levels of speed for each level
        l0=speedChange(0)(0),
        l02=speedChange(.2)(.2),
        l1=speedChange(1.1)(1.1),
        l2=speedChange(0)(1.2),
        l3=speedChange(1.3)(1.3),
        s9=speedChange(2.1)(2),
        //initial body objects
        b = init.bots,
        p = init.players,
        bl= init.ball
    
    const cl= new List(
    cons( //0 Slow and steady
        {...init},
    cons( //1 Slower player faster bot
        {...init, 
            players:p.map(l1),
            bots:   b.map(l2)},
    cons(//2 Fast everything (tests reactions)
        {...init, 
            players:p.map(l3),
            bots:   b.map(l3),
            ball:   l3(bl)},
    cons( //3 Fat bot
        {...init, 
            players:p.map(l1),
            bots:   b.map(sizeChange(10)(100)).map(l1),
            ball:l1(bl)},
      cons(//4 Two bots. One slower than the other. 
        {...init, 
            players:p.map(l1),
            bots:   b
                    .concat(b.map(l02).map(posChange(550)(0))),
            ball:l1(bl)},
    cons(//5 Two fat bots
        {...init, 
            players:p.map(l1),
            bots:   b
                    .concat(b.map(l02).map(posChange(550)(0))).map(sizeChange(10)(100))
            },
    cons( //6 Adds two bots that act a wall
        {...init, 
            players:p.map(l1),
            bots:   b.map(posChange(580)(0)).map(sizeChange(10)(100))
                    .concat(b.map(posChange(580)(500))).map(sizeChange(10)(100)).map(l3)
                    .map(l0)
                    .concat(b.map(speedChange(0)(0.9)).map(posChange(560)(300)))
    },
    cons( //7 Try slot it through a gap (harder than you think)
        {...init,
            ball:   l1(bl),
            bots:   b.map(posChange(500)(0)).map(sizeChange(10)(400))
                    .concat(b.map(posChange(500)(490)).map(sizeChange(10)(100))).map(l0)
    },
    cons( //8 A small and fast bot. Increased deflection angles as it's smol.
        {...init,
            bots:   b.map(sizeChange(10)(10)).map(l3)},//8
    cons(//9 Just super duper quick classic pong
        {...init,
            bots:   b.map(s9),players:p.map(s9),
            ball:   s9(bl)}
    ,null)))))))))))

    return level > 9 || level < 0? {...init,level:0}: cl.get(level);
  }
  /**
   * Classes for different observable responses.
   */
  //Used to move the player. allows for expandibility with the num attrribute (eg w/s keys for a second player). The vector is the direction to move.
  class MovePlayer { constructor(public readonly vec: Vec, public readonly num: number) {} }
  //This wouldnt be in the final release of the game however if you find it too ahrd to skip levels to test the game you can click the left arrow key
  class ChangeLevel { constructor(public readonly num: number) {} }
  //Used to pause or unpause the game
  class PauseGame {}
  //used to restart the game
  class Restart {}
 
 /**
  * Continuously takes the previous state and returns the next one based on the input from the user
  * @author 'Arie Hendrikse', 'Tim Dwyer'
  * @param s previous state
  * @param e The event from the player
  */
  const reduceStatePure =(maxLevel:number)=> (s:State, e:MovePlayer|PauseGame|ChangeLevel|Restart)=>{
      return e instanceof Restart? 
      {...levels(0)}
      :e instanceof PauseGame ?
      //pauses/unpauses the state of the game and displays a pause message when paused
      { ...s, paused:!s.paused,canvasMessage:s.paused?'':'PAUSED' 
      }:(e instanceof 
      // used to hack the game and change the levels
        ChangeLevel && (e.num+s.level<maxLevel) && (e.num+s.level>0))?  {...levels(s.level+e.num),level:s.level+e.num}
        :e instanceof MovePlayer ?
        //Changes the player vector in the direction of the key press and removes it when keyup
        { ...s,paused:false, canvasMessage:s.time>5000?s.canvasMessage:'',
                          gameStarted:true,
                          scoreMessage:s.round==0?'0 : 0':s.scoreMessage, 
                          players: s.players.map(p=>moveObj({...p,vel:e.vec}))}
        : //when theres no user input calculate the next state from the previous.
          tick(s,1)
        }
        ;
  /**
   * Moves the body to a position calculated from the velocity and position on the board.
   * @param o 
   */
  const moveObjPure =(size:number)=> (o:Body):Body => {let newBody =<Body>{ //can curry this
    ...o,
    pos: o.pos.add(o.vel.product(o.speedFactor)),
  };
  //Checks if the object is in y bounds and whether to bounce it off the walls or not. if it bounces flips the Y velecity
  return inYBounds(newBody,size) ? newBody : !o.bounces ? {...o, vel: Vec.Zero}: {...o, vel: o.vel.flipY()}  ;
}
  // Types for different user events to listen to     
  type Event = 'keydown' | 'keyup' | 'keypress'
  // What keys to listen for events
  type Key = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' |'ArrowRight'|'Space'|'KeyR'
  /**
   * Creates an Observable that disregards key repetition (holding key) and filters anything that doesnt equal the key
   * @param eventName - The event to listen to
   * @param k - The key to listen for
   * @param result - Method that returns an instance of the resulting action from the user
   */
  const observeKey = <T>(eventName:string, k:Key, result:()=>T)=>
    fromEvent<KeyboardEvent>(document,eventName)
      .pipe(
        filter(({code})=>code === k),
        filter(({repeat})=>!repeat),
        map(result))
    /**
   * checks whether a body is in the y bounds of the canvas
   * @param b - the body to check
   * @param canvasSize - The size of a side of the canvas
   */
  const inYBounds = (b:Body, canvasSize: number):boolean => //could use currying to make less complex
    b.pos.y>0&&
    b.pos.y+b.height<canvasSize;
  /**
   * checks whether a body is in the x bounds of the canvas
   * @param b - the body to check
   * @param canvasSize - The size of a side of the canvas
   */
  const inXBounds = (b:Body, canvasSize: number):boolean =>
    b.pos.x>0&&
    b.pos.x+b.width<canvasSize;
  /**
   * Determines what vertical direction to move to get on body closer to the other
   * @param b1 - the body to chase
   * @param b2 - the body that is chasing
   */
  const chaseBodyPure = (canvasSize:number)=> (b1:Body)=>(b2:Body):Body => 
    {let newBody =<Body>{...b2,
      vel: new Vec(0,b1.pos.y+b1.height/2<=b2.pos.y+b2.height/2+5 && b1.pos.y+b1.height/2>=b2.pos.y+b2.height/2-5 ?
      0
      : b1.pos.y+b1.height/2>b2.pos.y+b2.height/2 ? 1 : -1)}
    return inYBounds(moveObj(newBody),canvasSize) ? newBody : b2 // might be inefficient
    }
  /**
   * Calculates whether two bodies are colliding
   * @param a 
   */
  const bodiesCollided = (a:Body)=>(b:Body):boolean => (a.pos.x<=b.pos.x+b.width) && (a.pos.x + a.width >= b.pos.x) && (a.pos.y<=b.pos.y+b.height) && (+a.pos.y + a.height >= b.pos.y);
  /**
   * Calculates the state after the ball goes out of bounds
   * @param s - the state of the game when the ball went out of bounds
   */
  const updateScorePure = (maxLevel:number)=> (maxScore: number) => (s: State): State =>{
    let score=calcScore(s)
    let round=s.round+1
    //Constants for calculating the score and level
    const
      //checks whethere either size has a score>the maxscore needed to proceed to the next level
      leftWins: boolean = round-(round-score)/2>=maxScore,
      rightWins: boolean = (round-score)/2 >= maxScore,
      //Calculates the individual scores from state
      leftScore: number = (leftWins||rightWins) ? 0 : round-(round-score)/2,
      rightScore: number =  (leftWins||rightWins) ? 0 :(round-score)/2,
      //Checks whether the level needs to be incremented or not
      levelIncrement:number =  leftWins ? 1 : rightWins && s.level>1 ? -1 : 0,
      scoreMessage:string =  String(leftScore) + ' : ' + String(rightScore),
      //Resets the scores or maintains them
      newScore:number = leftWins||rightWins ? 0 : score,
      newRound:number = leftWins||rightWins ? 0 : round,
      //next level
      l:number = s.level+levelIncrement
    
    return l<maxLevel?
    {...levels(l),level: l, gameStarted:s.gameStarted,scoreMessage:scoreMessage, round:newRound,score:newScore,
      //displays messages of support and also tells the player what is going on
      canvasMessage:levelIncrement==1?'Level Up!':levelIncrement==-1?'Level Down':score>s.score?'Nice Shot':'Unlucky there!' }:
    {...levels(0),level:0,gameStarted:false,canvasMessage:"You Win!"};
  }

  const tick = (s:State,elapsed:number): State => {
    if (s.paused) return <State>{...s};
    //The next state for most cases
    const next=nextState(elapsed)(s)
    return  s.gameOver ? updateScore(next) :
    s.gameStarted ? 
    {...next,players: s.players.map(moveObj) }:
      
    {...next,
      players: s.players.map(pad=>moveObj(chaseBody(s.ball)(pad))), //creates waiting screen effect of bots versing
      score:0,
      round:0,
      scoreMessage:'Use the arrow keys to play' }
  }
  const nextStatePure= (canvasSize:number)=> (elapsed:number)=>(s:State)=>{
    //create methods for calculating the rebound vector for the ball and whether a body collides with the ball
    const 
      hitBall =bodiesCollided(s.ball),
      reboundBall =reboundVector(s.ball)
    //The next state for most cases
    return <State>{...s, 
      ball: moveObj({...s.ball,
        //filter all the paddles that hit the ball and take the last value (only one rebound valid at a time)
        vel: s.players.concat(s.bots).filter(hitBall).map(reboundBall)
        //reduce takes previous value of ball as initialvalue in case there are no rebounds
        .reduce((a,b)=>b?b:a,s.ball.vel) 
      }),                                                 
      bots: s.bots.map((bot)=>moveObj(chaseBody(s.ball)(bot))),            
      time:elapsed+s.time,
      gameOver: !inXBounds(s.ball,canvasSize),
      }
  }

  /**
   * calculates the vector at which two bodies will rebound. Used for paddle rebound angles.
   * @param b1 The that will be colliding
   * @param b2 The body that is used to calculate the angle of the rebound 
   */
  const reboundVector = (b1: Body)=> (b2: Body): Vec =>{
    let speedIncrement=2*(((b1.pos.y+b1.height/2)-b2.pos.y)/b2.height)-1;
    return new Vec(-b1.vel.x,b1.vel.y+speedIncrement);
  }

/**
 * The event listeners for each key
 * @author 'Arie Hendrikse', 'Tim Dwyer'
 */
  const 
    moveDown = observeKey('keydown','ArrowDown', ()=>new MovePlayer(new Vec(0,1),0)),
    stopMoveDown = observeKey('keyup','ArrowDown', ()=>new MovePlayer(Vec.Zero,0)),
    moveUp = observeKey('keydown','ArrowUp', ()=>new MovePlayer(new Vec(0,-1),0)),
    stopMoveUp = observeKey('keyup','ArrowUp', ()=>new MovePlayer(Vec.Zero,0)),
    spacePress = observeKey('keypress','Space', ()=>new PauseGame),
    //these are here for testing levels, as I dont expect you to get through them very quickly
    levelUp = observeKey('keydown','ArrowRight', ()=>new ChangeLevel(1)),
    levelDown = observeKey('keydown','ArrowLeft', ()=>new ChangeLevel(-1)),
    restart = observeKey('keydown','KeyR', ()=>new Restart())
  
  /**
   * @param s State of the game
   * @return -1 if the right won 1 if the left won
   */
  const calcScorePure = (canvasSize:number)=> (s: State): number => s.ball.pos.x < canvasSize / 2 ? s.score - 1 : s.score + 1;
  
  
  /** Creates new methods based off of pure methods using constants. This way the original methods give the same answer each time, as the state of the system doesn't
   * affect their result.
   */
  const updateScore=updateScorePure(Constants.MaxLevel)(Constants.MaxScore),
        moveObj = moveObjPure(Constants.CanvasSize),
        nextState = nextStatePure(Constants.CanvasSize),
        reduceState=reduceStatePure(Constants.MaxLevel),
        calcScore = calcScorePure(Constants.CanvasSize),
        chaseBody=chaseBodyPure(Constants.CanvasSize)

  /** The observable subscription that updates every millisecond. Merges the key streams 
   *  into a single stream and passes their result action instance into reducestate. Then updates the view of each state
   * @author 'Arie Hendrikse', 'Tim Dwyer'
   */
  const subscription = interval(1)
  .pipe(
    merge(moveDown,stopMoveDown,moveUp,stopMoveUp,spacePress,levelDown,levelUp,restart),
    scan(reduceState, levels(0)))
  .subscribe(updateView);
  }
  // runs pong function on window load
  if (typeof window != 'undefined')
    window.onload = ()=>{
      pong();
    }
