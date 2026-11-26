// Tech Club "Club Helper": a small help bot for the Tech Club robot and micro:bit pages.
//
// It is NOT an AI and it is NOT a person. It is a list of questions and answers (ENTRIES below)
// and a simple word matcher. It makes no network calls. Nothing a student types leaves the page
// and nothing is stored (no cookies, no localStorage, no sessionStorage).
//
// It shows only for members and the owner:
//   techclub.html        watches #member-view (the page shows it only after the club check passed)
//   techclub-build.html  watches #tc-content   (TechClub.requireMember shows it for members)
//   techclub-code.html   watches #tc-content
// The join card never makes the helper show up, because #member-view stays hidden there.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HOW TO ADD OR CHANGE AN ANSWER (the teacher can do this)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 1. Find the ENTRIES list below. Copy any entry and paste it at the end of its topic.
// 2. Fill in the fields:
//      id    A short unique name, like 'part-ball'. Never use the same id twice.
//      t     The topic. One of: 'kit', 'build', 'makecode', 'ext', 'code', 'drive', 'fix', 'safe', 'help'.
//      q     The question as a student would say it. It is the text on the button (the "chip").
//      a     The answer. 1 to 4 SHORT sentences, plain words. Never invent numbers, colours,
//            battery types or booklet page numbers. If you are not sure write:
//            'Check your booklet, or ask Mr. Capellini.'
//      link  Where to send the student. A name from ANCHORS (see below), or a list of two names,
//            or leave it out. Example: 'lesson4' or ['step-connect', 'lesson3'].
//      k     Words and phrases a student might use. The matcher lowercases, ignores small words
//            (the, a, is, how...), ignores plurals and -ing / -ed, and fixes some spelling.
//            A phrase like 'motor not spin' matches when all its words are in the question,
//            near each other, in any order. Longer phrases are worth more.
//            Add ^number to give a word or phrase more weight: 'wheel^4'.
//            Single common words (like 'motor') are worth little on their own, on purpose.
//      rel   (optional) ids of 1 or 2 entries to show as "Related" buttons.
// 3. Synonyms and common misspellings live in SYN. 'tyre: wheel' means the word tyre counts as wheel.
// 4. Run the test: node $S/club-helper/matcher-test.mjs  (every entry should still be found by its
//    own question, and the off-topic and gibberish questions should still get the fallback).
// 5. To point to a new step or lesson, give the heading an id in the page, then add it to ANCHORS.
// ─────────────────────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var ASK = 'Check your booklet, or ask Mr. Capellini.';
  var FALLBACK_TEXT = 'I am not sure about that one. Try one of these topics, or ask Mr. Capellini.';
  var THRESHOLD = 3.0;           // the lowest score that counts as an answer
  var MAX_LEN = 300;             // the matcher only reads this many characters

  // Where each link goes. [page, anchor id, label]. The ids are in the pages.
  var BUILD = 'techclub-build.html', CODE = 'techclub-code.html';
  var ANCHORS = {
    'build-booklet': [BUILD, 'build-booklet', 'Build page: the booklet'],
    'build-parts':   [BUILD, 'build-parts', 'Build page: 1. Check your parts'],
    'build-extra':   [BUILD, 'build-extra', 'Build page: parts you may need to bring'],
    'build-order':   [BUILD, 'build-order', 'Build page: 2. Build in order'],
    'step-fold':     [BUILD, 'step-fold', 'Build step 1: Fold the chassis'],
    'step-motors':   [BUILD, 'step-motors', 'Build step 2: Put on the motors'],
    'step-wheels':   [BUILD, 'step-wheels', 'Build step 3: Put on the wheels'],
    'step-ball':     [BUILD, 'step-ball', 'Build step 4: Add the ball'],
    'step-band':     [BUILD, 'step-band', 'Build step 5: Use the rubber band'],
    'step-connect':  [BUILD, 'step-connect', 'Build step 6: Connect the motors'],
    'step-microbit': [BUILD, 'step-microbit', 'Build step 7: Plug in the micro:bit'],
    'step-power':    [BUILD, 'step-power', 'Build step 8: Add power'],
    'build-check':   [BUILD, 'build-check', 'Build page: 3. Check it works'],
    'build-safety':  [BUILD, 'build-safety', 'Build page: Stay safe'],
    'code-note':     [CODE, 'code-note', 'Code page: about MakeCode'],
    'code-lessons':  [CODE, 'code-lessons', 'Code page: all the lessons'],
    'lesson0':       [CODE, 'lesson0', 'Lesson 0: Open MakeCode'],
    'lesson1':       [CODE, 'lesson1', 'Lesson 1: Hello micro:bit'],
    'lesson2':       [CODE, 'lesson2', 'Lesson 2: Add the Klip Motor extension'],
    'lesson3':       [CODE, 'lesson3', 'Lesson 3: Spin one motor with button A'],
    'lesson4':       [CODE, 'lesson4', 'Lesson 4: Drive forward'],
    'lesson5':       [CODE, 'lesson5', 'Lesson 5: Turn'],
    'lesson6':       [CODE, 'lesson6', 'Lesson 6: Drive a square'],
    'lesson7':       [CODE, 'lesson7', 'Lesson 7: Make your own course']
  };

  var TOPICS = [
    { id: 'kit',      name: 'The kit and its parts' },
    { id: 'build',    name: 'Building the robot' },
    { id: 'makecode', name: 'MakeCode basics' },
    { id: 'ext',      name: 'The Klip Motor extension' },
    { id: 'code',     name: 'Motors, speed and buttons' },
    { id: 'drive',    name: 'Driving, turning, squares' },
    { id: 'fix',      name: 'Fixing problems' },
    { id: 'safe',     name: 'Safety and tidy-up' },
    { id: 'help',     name: 'Getting help' }
  ];

  // Words that mean the same thing. variant: what it counts as. Spelling mistakes go here too.
  var SYN = {
    wheel: 'tire tires tyre tyres whel whell wheal weel whels wheeel wheelz wheell',
    motor: 'engine engines moter motr motar mottor mtr motoor',
    robot: 'car buggy bot bots robo robbot robit robbo vehicle rover machine buggie robots',
    spin: 'rotate rotates rotating rotation twirl whirl spinn',
    not: 'dont doesnt wont cant cannot isnt arent didnt wasnt couldnt wouldnt shouldnt no never without havent hasnt dosnt dnt wount doesn dont\'t nt',
    microbit: 'micorbit microbits mikrobit mircobit mircrobit microbot microbbit',
    makecode: 'makecod makcode makecoed makecde',
    download: 'downlaod dowload donwload downoad downlod',
    extension: 'extention extenstion addon plugin plugins extentions',
    clip: 'alligator crocodile aligator alegator aligater clamp',
    wire: 'cable cord lead jumper wires',
    forward: 'foward forwards forwad forwerd ahead',
    backward: 'backwards bakward backwrds',
    stop: 'halt stoped',
    fast: 'quick quickly rapid speedy faster fastest',
    slow: 'slowly sluggish crawling slower slowest',
    code: 'program programming script coding programs',
    broken: 'broke busted dead faulty',
    teacher: 'capellini teacher mr mister sir',
    colour: 'color colors colours',
    chassis: 'chasis chasssis chassi chasses chassy',
    button: 'buton botton buttom buttn',
    simulator: 'simulater simulation simulate sim',
    javascript: 'java js javascrip javascipt',
    pause: 'wait delay sleep',
    speed: 'velocity rpm',
    fold: 'bend folded folds',
    connect: 'hook plug join link',
    attach: 'fix mount install fit stick put place push',
    drive: 'go goes going went',
    tidy: 'clean cleanup',
    battery: 'batteries batery baterry batterys',
    circle: 'circles circular',
    rubberband: 'elastic',
    help: 'halp hlp'
  };

  // The stopwords: small words that carry no meaning for matching.
  var STOP = ('a an the is are was were am be been it its i me my we our you your to of in at for with and or but so this that ' +
    'these those there here do does did can could will would should how what when where why which who please pls just really very ' +
    'also then than as if by from about into im ive ill id some any have has had like thing stuff because ok okay yes ' +
    'hey hi yo').split(' ');

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // THE KNOWLEDGE BASE
  // ───────────────────────────────────────────────────────────────────────────────────────────
  var ENTRIES = [
    // ── kit: the kit and its parts ─────────────────────────────────────────────
    { id: 'parts-list', t: 'kit', q: 'What is in the kit box?',
      a: 'This is the Kitronik Simple Robotics Kit for the BBC micro:bit. The box has the Klip Motor Driver, 2 small geared motors, 2 wheels with tyres, clip leads, a cardboard chassis, a ping pong ball and a rubber band. Tick them off on the build page.',
      link: 'build-parts', rel: ['parts-missing', 'build-order'],
      k: ['kit^4', 'box^1.5', 'parts^1.5', 'part^1.5', 'kitronik^5', 'simple robotics^5', 'whats in the box^5', 'in the box^4', 'included^3.2',
          'contents^3.2', 'check parts^5', 'check my parts^5', 'what do i get^4', 'pieces^3.2', 'components^3.2', 'inventory^3.2', 'tick parts^4',
          'checklist^5', 'robotics kit^5', 'what comes with^4', 'all the parts^4'] },
    { id: 'parts-missing', t: 'kit', q: 'What is NOT in the box?',
      a: 'The micro:bit, scissors and a small screwdriver may not be in the box. Check, and ask Mr. Capellini. Check your booklet to see how to power the robot.',
      link: 'build-extra', rel: ['parts-list', 'part-microbit'],
      k: ['not box^5', 'missing^3', 'need to bring^5', 'bring^3', 'else need^5', 'what else^3', 'extra parts^4', 'extra^1.5', 'forgot^2',
          'not included^5', 'not in the kit^5', 'do i need to bring^5', 'bring my own^4', 'what to bring^5', 'need own^3', 'part missing^4', 'missing part^5',
          'cant find microbit^4', 'no microbit^4', 'no scissors^4', 'no screwdriver^4', 'which tools^4', 'tools^1.5', 'tool^1.5', 'bring scissors^9', 'need scissors^9', 'have scissors^9', 'bring screwdriver^9', 'need screwdriver^9'] },
    { id: 'part-driver', t: 'kit', q: 'What is the Klip Motor Driver?',
      a: 'The Klip Motor Driver is the motor board. The micro:bit plugs into it. The motors connect to it at Motor 1 and Motor 2.',
      link: 'build-parts', rel: ['step-connect', 'part-microbit'],
      k: ['motor driver^6', 'klip motor driver^7', 'driver^5', 'motor board^6', 'board^5', 'klip^5', 'what is the klip^5', 'circuit board^4', 'green board^3', 'controller^1.5'] },
    { id: 'part-motors', t: 'kit', q: 'What are the two motors for?',
      a: 'The kit has 2 small geared motors. One motor turns each wheel. When the motors spin, the wheels spin and the robot moves.',
      link: ['build-parts', 'step-motors'], rel: ['part-wheels', 'step-motors'],
      k: ['geared motor^6', 'gear^3', 'gears^3', 'gearbox^4', 'how many motors^6', 'two motors^5', '2 motors^5', 'what do the motors do^6', 'motor for^3', 'what are the motors^5', 'motors^2', 'motor^1'] },
    { id: 'part-wheels', t: 'kit', q: 'How do the wheels go on?',
      a: 'The kit has 2 wheels with tyres. Push a wheel with its tyre onto each motor. Then check the wheel turns easily.',
      link: 'step-wheels', rel: ['t-wheel-rub', 'step-motors'],
      k: ['wheel^3', 'tyre^3', 'how many wheels^6', 'put on wheel^6', 'attach wheel^6', 'wheel on^5', 'wheel go on^6', 'push wheel^5', 'add wheel^5', 'fit wheel^5', 'wheel motor^4', 'wheels^3', 'step 3^3'] },
    { id: 'part-clip', t: 'kit', q: 'What are clip leads?',
      a: 'Clip leads are wires with a clip on each end. They are also called alligator clips. You use them to join the motors to the Klip Motor Driver.',
      link: 'step-connect', rel: ['step-connect', 's-clips'],
      k: ['clip^4', 'clip lead^6', 'alligator clip^6', 'wire^3', 'coloured wire^4', 'what are the wires^5', 'what are the clips^5', 'what are leads^5', 'crocodile clip^5', 'clips^4', 'clip lead^8', 'clip wire^8'] },
    { id: 'part-chassis', t: 'kit', q: 'What is the chassis?',
      a: 'The chassis is the body of the robot. It is one flat piece of cardboard. You cut it and fold it into shape.',
      link: 'step-fold', rel: ['build-order', 's-scissors'],
      k: ['chassis^5', 'cardboard^4', 'body^1.5', 'frame^1.5', 'base^1.5', 'fold chassis^6', 'folding^3', 'fold^3', 'cut chassis^5', 'one piece^4', 'flat piece^4', 'step 1^3', 'cut cardboard^5', 'cut^1.5', 'fold cardboard^5', 'cut cardboard^8'] },
    { id: 'part-ball', t: 'kit', q: 'What is the ping pong ball for?',
      a: 'The ping pong ball is the caster. It helps the robot roll along the floor. Add it as the booklet shows.',
      link: 'step-ball', rel: ['build-order', 'part-band'],
      k: ['ping pong^6', 'pingpong^6', 'ball^5', 'caster^5', 'castor^5', 'third wheel^5', 'roll^3', 'table tennis^4', 'step 4^3', 'add ball^5', 'ball for^5'] },
    { id: 'part-band', t: 'kit', q: 'What is the rubber band for?',
      a: 'The kit has a rubber band. Use it where the booklet shows. Check your booklet, or ask Mr. Capellini.',
      link: 'step-band', rel: ['part-ball', 'build-order'],
      k: ['rubberband^6', 'rubber^5', 'band^4', 'elastic^4', 'rubber band for^7', 'step 5^3', 'use rubber band^6'] },
    { id: 'part-microbit', t: 'kit', q: 'What is the micro:bit?',
      a: 'The micro:bit is a small computer. You write the program for it in MakeCode. It plugs into the Klip Motor Driver. It may not be in the box, so ask Mr. Capellini.',
      link: 'step-microbit', rel: ['step-microbit', 'mc-what'],
      k: ['microbit^4', 'what is microbit^6', 'little computer^4', 'small computer^4', 'bbc^4', 'bbc microbit^6', 'where microbit^5', 'microbit board^4', 'brain^1.5'] },
    { id: 'part-booklet', t: 'kit', q: 'What is the booklet? Which page?',
      a: 'The printed booklet (version V1.4) has the exact steps and the pictures. If this page and the booklet are different, the booklet is right. I do not know the page numbers. Check your booklet, or ask Mr. Capellini.',
      link: 'build-booklet', rel: ['build-order', 'help-stuck'],
      k: ['booklet^6', 'guide^1.5', 'manual^5', 'instructions^4', 'instruction^4', 'v1 4^6', 'printed^4', 'kitronik guide^5', 'page number^6', 'which page^6', 'what page^6',
          'paper^1.5', 'pdf^1.5', 'picture^1.5', 'pictures^1.5', 'diagram^1.5', 'exact steps^5', 'booklet wrong^5', 'booklet different^5', 'page^4'] },
    { id: 'part-battery', t: 'kit', q: 'What batteries does it use?',
      a: 'I am not sure which batteries your kit uses. Check your booklet, or ask Mr. Capellini. Do not mix old and new batteries.',
      link: 'step-power', rel: ['power-on', 's-general'],
      k: ['battery^5', 'battery pack^6', 'aa^4', 'aaa^4', 'power source^5', 'what power^4', 'type of battery^6', 'which battery^6', 'batteries^5', 'charge^1.5', 'charging^1.5', 'cell^1.5', 'coin cell^4', 'rechargeable^4'] },
    { id: 'kit-what', t: 'kit', q: 'What are we making in Tech Club?',
      a: 'We build a small robot from the Kitronik Simple Robotics Kit. Then we write programs in MakeCode so it can drive and turn. You can even try to drive a square.',
      link: 'build-order', rel: ['parts-list', 'code-lessons'],
      k: ['project^1.5', 'tech club^3', 'make robot^5', 'build robot^5', 'goal^3', 'what are we building^6', 'what are we making^6', 'about club^4', 'what is this^3', 'what do we do^5', 'what is tech club^5', 'robotics^3'] },

    // ── build: building the robot ──────────────────────────────────────────────
    { id: 'build-order', t: 'build', q: 'What order do I build it in?',
      a: 'Go in this order. Fold the chassis, put on the motors, wheels, ball and rubber band, connect the motors, plug in the micro:bit, then add power. If your booklet puts the steps in a different order, follow the booklet.',
      link: 'build-order', rel: ['build-tips', 'build-check'],
      k: ['build^3.2', 'build order^6', 'order^1.5', 'steps^1.5', 'step^1.5', 'where start^5', 'start^1.5', 'first^1.5', 'what first^5', 'how build^5', 'put together^6', 'assemble^5', 'assembly^5',
          'how to build^5', 'building^3.2', 'what next^2', 'build robot^3', 'make robot^3', 'construct^5', 'which step^5', 'step by step^5', 'begin^1.5', 'first thing^1.5'] },
    { id: 'step-motors', t: 'build', q: 'How do I put on the motors?',
      a: 'Fix the two small motors to the chassis. Follow the booklet page for this step. You may need a small screwdriver, so check your booklet and ask Mr. Capellini.',
      link: 'step-motors', rel: ['step-connect', 'part-wheels'],
      k: ['put on motor^7', 'attach motor^7', 'mount motor^7', 'motor on chassis^7', 'motors chassis^6', 'step 2^3', 'screwdriver^5', 'screw^4', 'screws^4', 'fix motor^6', 'install motor^6', 'where motors go^6', 'motor goes^5', 'screwdriver motor^9', 'screwdriver for motors^9'] },
    { id: 'step-connect', t: 'build', q: 'How do I connect the motors with the clip leads?',
      a: 'Use the clip leads to join each motor to Motor 1 or Motor 2 on the Klip Motor Driver. Do not guess. Follow the booklet, or ask Mr. Capellini.',
      link: 'step-connect', rel: ['wiring-colour', 'part-clip'],
      k: ['connect motor^7', 'connect^3.2', 'motor 1^5', 'motor 2^5', 'which clip^6', 'which lead^6', 'which wire^6', 'wiring^3', 'wire up^6', 'where clips go^6', 'clip motor^6', 'where wires go^6', 'wire motor^6',
          'join motor^6', 'step 6^3', 'clip lead motor^7', 'motor1^3', 'motor2^3', 'clips on motor^6', 'wire the motors^6', 'where do the clips^6', 'attach wire^6', 'attach clip^6'] },
    { id: 'wiring-colour', t: 'build', q: 'Which colour clip goes where?',
      a: 'I do not know which colour goes where. Do not guess. Check your booklet, or ask Mr. Capellini.',
      link: 'step-connect', rel: ['step-connect', 'help-stuck'],
      k: ['colour^1.5', 'red^1', 'black^1', 'blue^1', 'which colour^8', 'colour clip^6', 'colour wire^6', 'what colour^6', 'red wire^5', 'black wire^5', 'polarity^5', 'plus^1.5', 'minus^1.5', 'positive^1.5', 'negative^1.5', 'right way^3', 'colour wire^8', 'colour clip^8', 'what colour wire^8'] },
    { id: 'step-microbit', t: 'build', q: 'How do I plug in the micro:bit?',
      a: 'Slide the micro:bit into the Klip Motor Driver, the right way round. Look at the booklet picture to check. Do not push hard.',
      link: 'step-microbit', rel: ['part-microbit', 'power-on'],
      k: ['plug microbit^7', 'connect microbit^7', 'put microbit^6', 'insert microbit^7', 'slide microbit^7', 'microbit slot^6', 'microbit in^4', 'right way round^6', 'upside down^6', 'which way microbit^7',
          'edge connector^5', 'microbit fit^6', 'step 7^3', 'microbit into driver^7', 'microbit way^5', 'attach microbit^7', 'microbit backwards^6', 'microbit wrong way^6', 'way round^8', 'microbit round^8', 'which way round^9', 'after connect motor^9', 'after step 6^8'] },
    { id: 'power-on', t: 'build', q: 'How do I power it on?',
      a: 'Add power the way the booklet says. Ask Mr. Capellini before you switch it on. Keep fingers and hair away from the wheels when the robot is on.',
      link: 'step-power', rel: ['s-general', 'part-battery'],
      k: ['power^3.2', 'power on^6', 'switch on^6', 'turn on robot^6', 'turn it on^5', 'on switch^5', 'switch^3', 'add power^6', 'power up^5', 'power robot^6', 'start robot^3', 'switch it on^6', 'how turn on^5',
          'step 8^3', 'power robot on^6', 'how do i power^7', 'power off^5', 'switch off^5', 'turn off robot^6', 'on off^3', 'powered^3', 'power it^5', 'plug in power^6', 'turn on^7', 'robot on^7', 'turn robot on^9'] },
    { id: 'build-check', t: 'build', q: 'How do I check my robot is ready?',
      a: 'Check that the wheels turn easily and nothing is loose. Check the clips are on tight and the metal ends are not touching. Check the micro:bit is the right way round. Then show Mr. Capellini.',
      link: 'build-check', rel: ['after-build', 'build-tips'],
      k: ['check works^6', 'check robot^6', 'ready^3.2', 'is it ready^6', 'built^3.2', 'test robot^5', 'before code^5', 'checklist^5', 'robot ready^6', 'check it works^7', 'am i done^5', 'is it built right^7', 'built right^6', 'checks^3.2'] },
    { id: 'build-tips', t: 'build', q: 'Any tips for building?',
      a: 'Do one step at a time. Read the booklet step first. Do not force parts. Ask a club partner to check your work.',
      link: 'build-order', rel: ['build-order', 'help-stuck'],
      k: ['tips^5', 'tip^5', 'advice^5', 'hints^5', 'hint^5', 'any tips^6', 'help building^6', 'easy^1.5', 'easier^1.5', 'careful^1.5', 'best way^4', 'trick^1.5', 'build tips^7', 'how to do better^5'] },
    { id: 'after-build', t: 'build', q: 'What do I do after I build it?',
      a: 'Show Mr. Capellini. Then go to the Code the robot page and do the lessons in order, starting with Lesson 0. Lesson 3 spins one wheel.',
      link: ['code-lessons', 'lesson3'], rel: ['mc-what', 'code-lessons'],
      k: ['after building^6', 'after build^6', 'finished^3.2', 'next step^4', 'what now^5', 'i finished^5', 'whats next^4', 'what do i do next^6', 'done^1.5', 'built it^5', 'what after^5', 'once built^5', 'after its built^6', 'done building^8', 'finished building^8', 'done build^8'] },

    // ── makecode: MakeCode basics ──────────────────────────────────────────────
    { id: 'mc-what', t: 'makecode', q: 'What is MakeCode?',
      a: 'MakeCode is a free coding website. It runs in your browser. You use blocks, and you can also see the same program as JavaScript.',
      link: 'lesson0', rel: ['mc-open', 'mc-blocks-js'],
      k: ['makecode^5', 'coding website^6', 'what do i code in^6', 'program in^4', 'software^1.5', 'app^1.5', 'editor^1.5', 'code editor^5', 'what is makecode^7', 'coding^1.5', 'blocks^1.5', 'what do we use to code^6'] },
    { id: 'mc-open', t: 'makecode', q: 'How do I open MakeCode?',
      a: 'Open makecode.microbit.org in your browser. It is free, and it runs in the browser. There is also a link at the top of the Code the robot page.',
      link: 'lesson0', rel: ['mc-new', 'mc-what'],
      k: ['open makecode^7', 'makecode website^7', 'website^5', 'url^5', 'address^1.5', 'makecode microbit org^7', 'where makecode^6', 'go to makecode^7', 'link makecode^6', 'where code^4', 'where do i code^6',
          'which website^6', 'what website^6', 'start makecode^6', 'get makecode^6', 'internet^1.5', 'open the editor^5', 'write code^7', 'type code^7', 'where type^6'] },
    { id: 'mc-new', t: 'makecode', q: 'How do I start a new project?',
      a: 'In MakeCode, click New Project. Type a name, like robot. Then click Create. You will see the micro:bit picture on the left and your blocks in the middle.',
      link: 'lesson0', rel: ['mc-open', 'ext-add'],
      k: ['new project^7', 'project^1.5', 'start project^6', 'create project^6', 'name project^5', 'name^1.5', 'start code^4', 'blank project^5', 'begin project^5', 'new program^5', 'make project^6', 'create^1.5', 'start new^5', 'new makecode^8'] },
    { id: 'mc-sim', t: 'makecode', q: 'What is the simulator?',
      a: 'The micro:bit picture on the left side of MakeCode is the simulator. It shows a pretend micro:bit running your program. Download your program to use it on the real micro:bit.',
      link: 'lesson0', rel: ['mc-download', 'mc-new'],
      k: ['simulator^7', 'pretend microbit^6', 'picture on left^6', 'virtual^1.5', 'preview^5', 'test without microbit^7', 'microbit picture^6', 'the picture^3', 'screen on left^5', 'run without robot^6', 'left microbit^7', 'looks like microbit^7', 'look microbit^7', 'test code not robot^8', 'not robot^6', 'run not robot^8', 'try code not robot^8'] },
    { id: 'mc-download', t: 'makecode', q: 'How do I get my program onto the micro:bit?',
      a: 'Plug the micro:bit into the computer with the USB cable. Click Download. Move the file onto the drive called MICROBIT. If your computer does it a different way, or you see pairing, ask Mr. Capellini.',
      link: 'lesson0', rel: ['t-nodownload', 'mc-sim'],
      k: ['download^6', 'send program^6', 'put code on microbit^7', 'put program^6', 'transfer^5', 'usb^5', 'flash^5', 'copy microbit^6', 'upload^5', 'pair^5', 'pairing^6',
          'connect microbit computer^7', 'load code^6', 'microbit drive^6', 'hex^1.5', 'run on microbit^6', 'get code onto^7', 'send code^6', 'get program^5', 'save to microbit^6', 'download code^7', 'bluetooth^1.5',
          'use on microbit^6', 'cable^3', 'put code robot^8', 'code on robot^8', 'code onto robot^8', 'program robot^8', 'put program on^8', 'attach code^8'] },
    { id: 'mc-blocks-js', t: 'makecode', q: 'What is the difference between blocks and JavaScript?',
      a: 'Blocks and JavaScript are two ways to show the same program. Click JavaScript at the top of MakeCode to see the code. Click Blocks to go back. These lessons use blocks and JavaScript.',
      link: 'lesson0', rel: ['mc-what', 'code-motoron'],
      k: ['javascript^6', 'blocks^3.2', 'block^1.5', 'text code^5', 'python^5', 'switch to javascript^7', 'difference blocks^6', 'type code^1.5', 'show code^4', 'blocks javascript^7', 'typing^1.5',
          'what is javascript^7', 'js^5', 'which is better^5', 'drag^1.5', 'code view^5', 'see code^7', 'code instead blocks^8', 'instead of blocks^8', 'explain blocks^6', 'what are blocks^7'] },
    { id: 'mc-startforever', t: 'makecode', q: 'What are "on start" and "forever"?',
      a: '"On start" runs one time, when the program begins. "Forever" runs again and again. You put your blocks inside them.',
      link: 'lesson1', rel: ['mc-hello', 'mc-buttons'],
      k: ['on start^7', 'forever^7', 'run once^6', 'loop forever^6', 'start block^5', 'what is on start^7', 'again and again^5', 'one time^5', 'repeat forever^6', 'forever block^7', 'starts^2'] },
    { id: 'mc-hello', t: 'makecode', q: 'How do I show Hello on the micro:bit?',
      a: 'Open Basic. Drag "show icon" into "on start" and "show string" into "forever". Type Hello in the box. Download it and watch the lights.',
      link: 'lesson1', rel: ['mc-startforever', 'mc-download'],
      k: ['hello^1.5', 'show icon^7', 'show string^7', 'heart^5', 'lights^3.2', 'leds^3.2', 'led^3.2', 'display^3.2', 'show text^6', 'scroll^3.2', 'print^3.2', 'say hello^7', 'show name^6', 'write word^6', 'show word^6', 'lesson 1^5', 'basic^1.5', 'show picture^6', 'say hello^7', 'show hello^7'] },
    { id: 'mc-different', t: 'makecode', q: 'My blocks look different from the lesson',
      a: 'If a block looks different in your MakeCode, trust the block picture in MakeCode. MakeCode changes now and then. The JavaScript on the lesson page should still help you.',
      link: 'code-note', rel: ['mc-blocks-js', 'ext-missing'],
      k: ['look different^7', 'different block^7', 'not same^5', 'doesnt match^6', 'blocks dont match^7', 'new version^5', 'changed^1.5', 'looks different^7', 'different from lesson^7', 'picture different^6', 'blocks different^7', 'dont look same^6'] },
    { id: 'mc-buttons', t: 'makecode', q: 'How do buttons A and B work?',
      a: 'Use the "on button A pressed" block from Input. Put blocks inside it. They run when you press A. Button B works the same way.',
      link: 'lesson3', rel: ['code-motoron', 't-button-nothing'],
      k: ['button^5', 'buttons^5', 'button a^6', 'button b^6', 'press^1.5', 'pressed^1.5', 'on button^6', 'input^1.5', 'press a^6', 'press b^6', 'a and b^5', 'ab button^6', 'use buttons^7', 'button block^7', 'button code^6', 'click button^5'] },

    // ── ext: the Klip Motor extension ──────────────────────────────────────────
    { id: 'ext-what', t: 'ext', q: 'What is an extension?',
      a: 'An extension adds new blocks to MakeCode. The Klip Motor extension adds the blocks that run the motors.',
      link: 'lesson2', rel: ['ext-add', 'ext-js-name'],
      k: ['extension^5', 'what is extension^7', 'add blocks^5', 'new blocks^5', 'plugin^5', 'package^5', 'library^5', 'extra blocks^5', 'extensions^5', 'why extension^6', 'what does extension do^7'] },
    { id: 'ext-add', t: 'ext', q: 'How do I add the Klip Motor extension?',
      a: 'In MakeCode, click Advanced, then Extensions. Search for: Kitronik Klip Motor. Click the Klip Motor box. You can also type the address github.com/KitronikLtd/pxt-kitronik-klip-motor.',
      link: 'lesson2', rel: ['ext-missing', 'ext-js-name'],
      k: ['add extension^7', 'klip motor extension^8', 'advanced^5', 'kitronik klip motor^8', 'install extension^7', 'get motor blocks^7', 'github^5', 'search extension^7', 'pxt^5', 'extensions advanced^7', 'add klip^6',
          'klip motor^5', 'find extension^7', 'import^1.5', 'add the motor blocks^7', 'kitronik^5', 'lesson 2^5', 'where extension^7', 'load extension^7', 'add package^6', 'search klip^6', 'how get motor blocks^7', 'advanced makecode^7', 'find kitronik^8', 'type kitronik^8', 'kitronik thing^8', 'find motor block^8', 'find klip^7', 'where klip^6'] },
    { id: 'ext-missing', t: 'ext', q: 'I cannot find the motor blocks',
      a: 'Click Advanced, then Extensions, and search for Kitronik Klip Motor again. Did you start a new project? Then add the extension again in that project. Still stuck? Ask Mr. Capellini.',
      link: 'lesson2', rel: ['ext-add', 'mc-different'],
      k: ['extension missing^8', 'not find^4', 'no motor blocks^8', 'motor blocks missing^8', 'where are the motor blocks^8', 'blocks gone^7', 'disappeared^5', 'not showing^6', 'cant find motor^8', 'motor block^5', 'missing blocks^7',
          'motor blocks not^7', 'where is motor on^7', 'no klip^6', 'extension not^6', 'extension gone^8', 'blocks not there^7', 'cant find blocks^7', 'lost blocks^7', 'extension not working^8', 'extension error^8', 'extension fail^8'] },
    { id: 'ext-js-name', t: 'ext', q: 'What is the extension name in JavaScript?',
      a: 'In JavaScript the extension name is kitronik_klip_motor. The blocks look like kitronik_klip_motor.motorOn and kitronik_klip_motor.motorOff.',
      link: 'lesson2', rel: ['code-motoron', 'mc-blocks-js'],
      k: ['extension name^7', 'name in javascript^7', 'kitronik klip motor javascript^8', 'namespace^5', 'javascript name^7', 'what is the extension called^7', 'extension called^7', 'js name^7', 'code name^5', 'kitronikklipmotor^9'] },

    // ── code: motors, speed and buttons ────────────────────────────────────────
    { id: 'code-motoron', t: 'code', q: 'How do I turn a motor on and off?',
      a: 'Use the "motor on" block to start a motor. Choose Motor1 or Motor2, a direction and a speed. Use "motor off" to stop it. Lesson 3 uses button A to turn Motor 1 on and button B to turn it off.',
      link: 'lesson3', rel: ['code-speed', 'mc-buttons'],
      k: ['motor on^7', 'motor off^7', 'motoron^7', 'motoroff^7', 'start motor^7', 'run motor^7', 'turn motor on^9', 'make motor go^9', 'one motor^6', 'spin one^6', 'single motor^6',
          'spin motor^7', 'spin wheel^6', 'lesson 3^6', 'start the motor^7', 'switch motor^6', 'motor block^6', 'how to run a motor^8', 'make motor spin^8', 'use motor^6', 'control motor^7', 'make wheel spin^7', 'test motor^6',
          'motor code^7', 'move motor^6', 'spin one wheel^7', 'drive motor^7'] },
    { id: 'code-speed', t: 'code', q: 'What does speed mean?',
      a: 'Speed is a number from 0 to 100. A bigger number makes the motor go faster. The lessons use 50. Try a few numbers to see what happens.',
      link: 'lesson3', rel: ['t-speed', 'code-direction'],
      k: ['speed^5', 'what is speed^7', '0 to 100^7', 'speed number^7', 'how fast^5', 'percent^5', 'what is 50^6', '100^1.5', 'number^1.5', 'speed value^7', 'what number^5', 'change speed^6', 'set speed^6', 'bigger number^6', 'what speed^7', 'max speed^6', 'maximum^1.5', 'top speed^6', 'full speed^6', 'the 50^5', '50^3.2', '20^3.2', '100^3.2'] },
    { id: 'code-direction', t: 'code', q: 'What do Forward and Reverse mean?',
      a: 'Forward spins a motor one way. Reverse spins it the other way. If a wheel goes the wrong way, swap Forward and Reverse in that block.',
      link: 'lesson3', rel: ['t-backward', 'code-turn'],
      k: ['reverse^5', 'forward^3.2', 'direction^5', 'motor direction^7', 'forward and reverse^8', 'other way^5', 'what is reverse^7', 'what is forward^7', 'forward block^6', 'reverse block^6', 'which direction^7', 'change direction^7', 'swap direction^7', 'motordirection^7', 'what does reverse do^9'] },
    { id: 'code-pause', t: 'code', q: 'What is pause (ms)?',
      a: 'Pause waits. The number is in milliseconds, so 800 is 800 thousandths of a second. The motors keep running while it waits. A longer pause means a longer drive.',
      link: 'lesson4', rel: ['code-further', 'code-change'],
      k: ['pause^5', 'ms^4', 'millisecond^6', 'delay^5', 'sleep^1.5', 'wait^1.5', 'how long^4', 'time^1.5', 'duration^4', 'pause time^7', 'what is 800^7', 'what is ms^7', 'the 800^5', 'pause block^7', 'what does pause do^8', 'what is pause^8'] },
    { id: 'code-stop', t: 'code', q: 'How do I make the robot stop?',
      a: 'Use "motor off" for Motor 1 and for Motor 2. Every "motor on" needs a "motor off". In Lesson 4 the robot stops after the pause.',
      link: 'lesson4', rel: ['code-motoron', 'code-pause'],
      k: ['stop^3.2', 'stop robot^6', 'wont stop^7', 'not stop^7', 'keeps going^7', 'never stops^7', 'run away^6', 'make stop^6', 'how to stop^7', 'stopping^3.2', 'wont stop moving^8', 'keep going^6', 'doesnt stop^7', 'how do i stop it^7', 'not stopping^7', 'stop the robot^7', 'will not stop^7', 'wheels keep^6', 'goes on^4', 'forever going^6', 'stop motor^8', 'not stop^9', 'never stop^9', 'end program^8', 'end code^8', 'stop wheel^8', 'stop turning^8', 'stop spin^8', 'wheel stop^8'] },
    { id: 'code-lessons', t: 'code', q: 'What lessons are there?',
      a: 'There are 8 lessons, numbered 0 to 7. You start with MakeCode and the extension, then spin a motor, drive, turn and drive a square. Lesson 7 is a challenge to make your own course.',
      link: 'code-lessons', rel: ['after-build', 'mc-what'],
      k: ['lessons^6', 'lesson^1.5', 'what lessons^7', 'list of lessons^7', 'what will i learn^7', 'all lessons^7', 'which lesson^6', 'how many lessons^7', 'lesson list^7', 'what lesson^6', 'learn^1.5', 'course^2', 'curriculum^3.2', 'what is lesson^6'] },

    // ── drive: driving, turning and squares ────────────────────────────────────
    { id: 'code-forward', t: 'drive', q: 'How do I make the robot drive forward?',
      a: 'Use "motor on" for Motor 1 and Motor 2, both Forward, speed 50. Add "pause (ms) 800". Then use "motor off" for both motors. Put the robot on the floor and press A.',
      link: 'lesson4', rel: ['code-further', 't-backward'],
      k: ['drive forward^8', 'drive^3.2', 'go forward^8', 'move forward^8', 'straight^3.2', 'drive straight^7', 'make it go^6', 'lesson 4^6', 'both motors^6', 'move^1.5', 'drive robot^7', 'move robot^7', 'make robot go^8', 'make robot move^8', 'make it drive^8',
          'run both motors^8', 'two motors forward^8', 'go straight^6', 'how do i drive^8', 'how to drive^8', 'make robot drive^8', 'robot move^6', 'get it moving^7', 'start driving^7', 'move car^6', 'robot go^6', 'wheels both^6'] },
    { id: 'code-turn', t: 'drive', q: 'How do I make the robot turn?',
      a: 'A robot turns when one wheel goes forward and the other goes back. In Lesson 5: Motor 1 Forward, Motor 2 Reverse, pause 400, then turn both motors off. You can also turn with only one motor on.',
      link: 'lesson5', rel: ['code-turn-amount', 'code-square'],
      k: ['turn^3.2', 'turn left^7', 'turn right^7', 'make it turn^8', 'turning^3.2', 'spin on the spot^9', 'spin around^7', 'left^1.5', 'right^1.5', 'lesson 5^6', 'corner^5', 'make robot turn^8', 'how to turn^8', 'rotate robot^7', 'turn robot^7', 'turn around^7',
          'go left^7', 'go right^7', 'steer^1.5', 'which way turn^6', 'turn on the spot^7', 'u turn^6', 'how do i turn^8', 'turn the robot^7', 'robot turn^7', 'one wheel back^7', 'spin the robot^6', 'swing^1.5', 'spin on spot^9'] },
    { id: 'code-turn-wrong', t: 'drive', q: 'It turns the wrong way',
      a: 'Swap Forward and Reverse between the two motors. Then download and try again. Which wheel is which depends on how you joined the clip leads.',
      link: 'lesson5', rel: ['code-turn', 't-backward'],
      k: ['wrong way turn^8', 'turns wrong^8', 'turn other way^8', 'turns left instead^8', 'turns right instead^8', 'opposite^5', 'turns the wrong way^9', 'wrong way^4', 'wrong direction turn^8', 'goes left not right^8', 'turns left^6', 'turns right^6', 'turn backwards^6', 'swap^1.5', 'swap motors^7', 'left and right mixed^8', 'other direction^6', 'mixed up^5', 'turns opposite^8', 'it turns the wrong way^9', 'want left^8', 'want right^8', 'turn right want left^10', 'turn left want right^10', 'turn right want left^12', 'turn left want right^12'] },
    { id: 'code-turn-amount', t: 'drive', q: 'How do I make a bigger or smaller turn?',
      a: 'Change the pause in the turn. A longer pause makes a bigger turn. A shorter pause makes a smaller turn. The right number depends on your robot, so change it a little and test.',
      link: 'lesson5', rel: ['code-square-corners', 'code-pause'],
      k: ['90 degrees^8', 'degrees^6', 'degree^6', 'angle^5', 'bigger turn^9', 'smaller turn^9', 'turn more^8', 'turn less^8', 'turns too far^8', 'turns too much^8', 'not enough^4', 'sharper^1.5', 'turn amount^7', 'exact turn^7', 'right angle^7', 'quarter turn^7',
          'turn too^6', 'turns too^7', 'turn 90^8', 'half turn^7', 'full turn^7', '180^1.5', '360^1.5', 'how far turn^8', 'turn size^7', 'turn bit^6', 'turn little^7', 'long turn^8', 'turn long^8'] },
    { id: 'code-square', t: 'drive', q: 'How do I drive a square?',
      a: 'Use "repeat 4 times". Inside it: both motors Forward, pause 800, then Motor 2 Reverse, pause 400. After the loop, turn both motors off. Press A and see if it is a square.',
      link: 'lesson6', rel: ['code-square-corners', 'code-turn'],
      k: ['square^7', 'drive a square^9', 'shape^1.5', 'rectangle^6', 'four sides^7', 'repeat^5', 'loop^5', 'repeat 4^8', 'lesson 6^7', 'for loop^6', 'again and again^3', 'drive in square^9', 'make square^8', 'triangle^5', 'draw square^8', 'repeat block^7', 'how repeat^7', 'make it repeat^8',
          'drive shape^7', 'robot square^8', 'path^1.5', 'repeat 4 times^9'] },
    { id: 'code-square-corners', t: 'drive', q: 'My square does not look like a square',
      a: 'Tune the turn pause (the 400) until the corners look square. Change the forward pause to make the square bigger or smaller. Change one number at a time, and test each time.',
      link: 'lesson6', rel: ['code-turn-amount', 't-curve'],
      k: ['not square^8', 'not a square^8', 'square wrong^8', 'corners^5', 'corner^5', 'wonky^6', 'crooked^6', 'uneven^6', 'tune^5', 'tuning^5', 'square bad^8', 'square not working^8', 'square not right^8', 'square wrong shape^8', 'square isnt^8', 'doesnt look square^9', 'not look square^9', 'bad square^8',
          'looks wrong^5', 'corners dont^7', 'is it a square^8', 'square messy^8', 'square not closing^8', 'doesnt close^7', 'doesnt end^5', 'ends in wrong place^8', 'not back to start^8', 'start point^6'] },
    { id: 'code-function', t: 'drive', q: 'How do I make my own function or course?',
      a: 'Open Advanced, then Functions, and click "Make a Function". Name it forward and put the forward blocks inside. Make another one called turn. Then call them in one "on button A pressed" block to drive your course.',
      link: 'lesson7', rel: ['code-square', 'code-forward'],
      k: ['function^7', 'functions^7', 'make function^8', 'call function^8', 'turnright^7', 'own course^8', 'challenge^6', 'obstacle^6', 'box^1.5', 'reuse^6', 'use again^6', 'lesson 7^7', 'my own course^8', 'turnleft^7', 'make a course^8', 'maze^5', 'custom^1.5',
          'make my own^7', 'plan path^7', 'plan a path^7', 'around a box^8', 'obstacle course^9', 'name a function^8', 'what is a function^9', 'advanced functions^8'] },
    { id: 'code-further', t: 'drive', q: 'How do I make it go further or less far?',
      a: 'Change the number in "pause (ms)". A bigger pause makes it go further. A smaller pause makes it go less far. Test it and change it a little at a time.',
      link: 'lesson4', rel: ['code-pause', 'code-change'],
      k: ['further^7', 'farther^7', 'go longer^7', 'longer^5', 'shorter^5', 'go further^8', 'drive further^8', 'less far^8', 'stop sooner^8', 'stop later^8', 'make it go far^8', 'distance^6', 'how far^6', 'go far^7', 'more distance^8', 'less distance^8', 'go less^6', 'drive less^7',
          'drive more^7', 'go more^6', 'shorter distance^8', 'longer distance^8', 'far^1.5', 'meter^1.5', 'metre^1.5', 'foot^1.5', 'feet^1.5', 'centimetre^1.5', 'cm^1.5', 'inches^1.5', 'go further^9', 'drive further^9', 'make it go further^10'] },
    { id: 'code-change', t: 'drive', q: 'What can I change to make it better?',
      a: 'Change the pause for how far it goes and how big a turn is. Change the speed to go faster or slower. Change Forward and Reverse to change direction. Change one thing at a time.',
      link: 'lesson4', rel: ['code-further', 'code-speed'],
      k: ['change^1.5', 'tweak^5', 'adjust^5', 'improve^5', 'make it better^8', 'what can i change^9', 'try this^6', 'customise^5', 'customize^5', 'experiment^5', 'what to change^9', 'what should i change^9', 'what do i change^9', 'better^1.5', 'fix numbers^6', 'which number^6', 'what numbers^6', 'play with^5', 'modify^5'] },

    // ── fix: fixing problems ───────────────────────────────────────────────────
    { id: 't-motor-nospin', t: 'fix', q: 'A motor does not spin',
      a: 'Check the power first. Check the clip leads are on tight, at Motor 1 or Motor 2. Check you added the Klip Motor extension and downloaded your newest program. Still stuck? Ask Mr. Capellini.',
      link: ['step-connect', 'lesson3'], rel: ['t-button-nothing', 't-clips-fall'],
      k: ['motor not spin^9', 'motor not work^9', 'wont spin^8', 'wheel not turn^9', 'not move^6', 'wheel wont turn^9', 'dead motor^8', 'nothing moves^8', 'wont move^8', 'no movement^8', 'one wheel not^9', 'wheel not spin^9', 'wheels not^5', 'motors not^5', 'motor stopped^7', 'motor stuck^7',
          'robot not move^9', 'robot wont move^9', 'only one wheel^9', 'one wheel only^9', 'one motor not^9', 'no spin^7', 'not spinning^8', 'doesnt spin^8', 'motor dead^8', 'motor broken^8', 'doesnt work motor^9', 'wheel dead^8', 'wheels dont^8', 'not turning^7', 'motor not working^9',
          'robot not working^8', 'not driving^8', 'wont drive^8', 'wont go^7', 'not go^6', 'wont work^4', 'doesnt move^8', 'wheel doesnt^8', 'wheels dont turn^9', 'wheel not moving^9', 'robot dead^8', 'robot broken^8', 'nothing moves^8', 'one side not^9', 'side not work^9', 'side not^8'] },
    { id: 't-circle', t: 'fix', q: 'Both wheels spin but the robot goes in a circle',
      a: 'Both motors must go Forward to drive straight. If one is Reverse, the robot spins in a circle. Check both "motor on" blocks. If both say Forward and it still circles, swap Forward and Reverse on one of them, or check your clip leads in the booklet.',
      link: 'lesson4', rel: ['t-curve', 't-backward'],
      k: ['circle^8', 'in circles^9', 'goes round^8', 'spins around^8', 'spinning in place^9', 'round and round^9', 'keeps turning^8', 'turns by itself^8', 'goes in a circle^9', 'goes round and round^9', 'drive circle^8', 'circling^8', 'going round^8', 'spinning^5', 'keeps spinning^8', 'spin in circles^9',
          'spin in place^8', 'twirl^5', 'doughnut^5', 'donut^5', 'both wheels spin but^8', 'spin but^7', 'goes around^7', 'turning in circles^9', 'drives in circle^9'] },
    { id: 't-curve', t: 'fix', q: 'Why does it curve or drive different distances?',
      a: 'Two motors are never exactly the same, so one wheel can go a little faster. That makes the robot curve. Check that no wheel is rubbing. Try a slightly lower speed on the faster side, and test. The lessons say the right numbers depend on your robot.',
      link: 'lesson4', rel: ['t-circle', 't-wheel-rub'],
      k: ['curve^5', 'curves^5', 'curving^5', 'not straight^8', 'crooked^5', 'veer^5', 'goes to one side^9', 'pulls^5', 'drift^5', 'different distance^9', 'different distances^9', 'not same distance^9', 'same distance every time^9', 'inconsistent^7', 'bends^5', 'wobbles off^6', 'goes sideways^8',
          'leans^5', 'swerve^5', 'curves left^9', 'curves right^9', 'veers^5', 'goes off line^8', 'not straight line^8', 'drives crooked^9', 'every time different^8', 'different every time^9', 'not the same^6', 'distance different^8', 'goes different^7', 'random^1.5', 'inaccurate^1.5', 'accurate^1.5', 'wanders^5', 'pulls left^9', 'pulls right^9', 'drifts^5', 'bend^5', 'not go straight^9', 'not drive straight^9', 'not straight^8', 'wont go straight^9'] },
    { id: 't-backward', t: 'fix', q: 'The robot goes backward',
      a: 'Change Forward to Reverse in both "motor on" blocks. Then download and try again. If it only turns, check both blocks match.',
      link: 'lesson4', rel: ['code-direction', 't-circle'],
      k: ['backward^8', 'goes back^8', 'reverse instead^8', 'wrong direction^8', 'goes the wrong way^9', 'going backwards^9', 'drives backwards^9', 'goes backwards^9', 'back instead^8', 'wrong way^6', 'drive back^7', 'moves back^8', 'backwards^8', 'the wrong way^7',
          'goes opposite^8', 'drives wrong^8', 'goes in reverse^9', 'it goes back^8', 'goes the other way^9', 'goes wrong way^9', 'moving backward^9', 'back not forward^9', 'goes behind^7', 'it reverses^8', 'wrong direction robot^9', 'move reverse^8', 'robot reverse^7', 'drive reverse^8', 'in reverse^8'] },
    { id: 't-speed', t: 'fix', q: 'It is too fast or too slow',
      a: 'Change the speed number in the "motor on" blocks. It goes from 0 to 100. A smaller number is slower and a bigger number is faster. Try 20, 50 and 100 to see the difference.',
      link: 'lesson3', rel: ['code-speed', 't-curve'],
      k: ['too fast^9', 'too slow^9', 'so fast^8', 'so slow^8', 'slow down^8', 'speed up^8', 'slow^5', 'zoom^5', 'crawl^6', 'weak^1.5', 'faster^6', 'fast^5', 'so quick^7', 'way too fast^9', 'goes too fast^9', 'very slow^8', 'slowly^6', 'barely moves^8', 'lazy^1.5', 'sluggish^6', 'quick^1.5', 'rushes^6',
          'zooms^5', 'rocket^1.5', 'crashes^1.5', 'crash^1.5', 'hits wall^8', 'hit the wall^8', 'bump^1.5', 'bumps^1.5', 'too weak^8', 'too strong^8', 'power weak^8', 'not strong^7', 'weak motor^8', 'make it slower^9', 'make it faster^9', 'drives slowly^9', 'drives fast^8'] },
    { id: 't-button-nothing', t: 'fix', q: 'Nothing happens when I press a button',
      a: 'Did you click Download and put the file on the micro:bit? Download again after each change. Check the power is on. Check the program has an "on button A pressed" block with a "motor on" block inside it. Then press the right button.',
      link: ['lesson3', 'lesson0'], rel: ['t-nodownload', 't-motor-nospin'],
      k: ['nothing happens^9', 'button doesnt work^9', 'button not working^9', 'press button nothing^9', 'no response^8', 'doesnt react^8', 'doesnt work^6', 'not working^6', 'wont work^6', 'doesnt do anything^9', 'does nothing^9', 'nothing^1.5', 'button nothing^9', 'dead button^8',
          'pressed nothing^9', 'press a nothing^9', 'press b nothing^9', 'program not working^9', 'code not working^9', 'code doesnt work^9', 'code wont work^9', 'not respond^8', 'no reaction^8', 'does not react^8', 'i pressed^6', 'pressing^1.5', 'still nothing^9', 'nothing at all^9', 'my code doesnt^8', 'program doesnt^8',
          'doesnt start^8', 'not start^7', 'wont start^8', 'not running^7', 'not run^6', 'does not run^8', 'ignores^1.5', 'not responding^8', 'stopped working^8', 'no response from robot^9'] },
    { id: 't-nodownload', t: 'fix', q: 'The code will not download',
      a: 'Check the USB cable is plugged in at both ends. Look for the drive called MICROBIT, and try Download again. If it still does not work, ask Mr. Capellini.',
      link: 'lesson0', rel: ['mc-download', 't-button-nothing'],
      k: ['wont download^9', 'cant download^9', 'download not working^9', 'download failed^9', 'download error^9', 'microbit not showing^9', 'no microbit drive^9', 'usb not found^9', 'cant find microbit^8', 'not detected^8', 'connect failed^9', 'pairing failed^9', 'error^1.5', 'failed^1.5',
          'fails^1.5', 'download problem^9', 'cant send^7', 'wont send^8', 'wont transfer^8', 'download doesnt work^9', 'computer doesnt see^9', 'microbit not found^9', 'cant connect^8', 'wont connect^8', 'microbit not connect^9', 'no drive^7', 'usb problem^8', 'download stuck^9',
          'pairing not working^9', 'pair not working^9', 'not pairing^9', 'wont pair^9', 'download wont^9'] },
    { id: 't-extension', t: 'fix', q: 'The extension will not load',
      a: 'Check the computer is online. Click Advanced, then Extensions, and search for Kitronik Klip Motor again. If it still will not load, ask Mr. Capellini.',
      link: 'lesson2', rel: ['ext-add', 'ext-missing'],
      k: ['extension wont load^9', 'extension not loading^9', 'cant add extension^9', 'extension error^9', 'extension failed^9', 'wont add^8', 'extension not work^9', 'cant install^8', 'install failed^9', 'extension problem^9', 'extension broken^9', 'no extensions^8', 'extension doesnt load^9', 'cant add klip^9', 'search finds nothing^9', 'search nothing^8', 'extension wont^9'] },
    { id: 't-clips-fall', t: 'fix', q: 'The clip leads keep falling off',
      a: 'Press each clip on firmly so it holds tight. Do not let the metal ends touch each other. If a clip keeps falling off, ask Mr. Capellini.',
      link: 'step-connect', rel: ['s-clips', 'step-connect'],
      k: ['clips fall off^9', 'clip falls off^9', 'keeps falling off^9', 'lead falls^8', 'loose^6', 'clips loose^9', 'wire loose^9', 'comes off^7', 'come off^7', 'disconnect^7', 'disconnects^7', 'falls out^7', 'unplugs^7', 'slips^7', 'clip off^7', 'wires fall^8', 'wire falls off^9', 'wires come off^9',
          'wont stay on^9', 'wont hold^8', 'not tight^8', 'fall off^7', 'falls off^7', 'pops off^8', 'slides off^8', 'clip wont stay^9', 'clip wont grip^9', 'clips wont stay on^9', 'wont stay^7', 'clip keeps^8'] },
    { id: 't-wheel-rub', t: 'fix', q: 'A wheel rubs or wobbles',
      a: 'Check the wheel is pushed on straight and all the way. Check it is not touching the chassis. If it still wobbles or rubs, ask Mr. Capellini.',
      link: 'step-wheels', rel: ['part-wheels', 't-curve'],
      k: ['wheel rubs^9', 'rubbing^8', 'wobble^8', 'wobbles^8', 'wobbly^8', 'scraping^8', 'touching^5', 'wheel stuck^8', 'stuck wheel^8', 'wheel loose^9', 'wheel falls off^9', 'squeak^6', 'noisy^6', 'grinding^7', 'wheel wobbles^9', 'wheel comes off^9', 'wheel rubbing^9', 'rubs^7', 'rub^7', 'scrapes^7',
          'wheel not straight^9', 'bent wheel^9', 'wheel crooked^9', 'wheel falls^8', 'wheel wont stay^9', 'wheel slips^8', 'wheel pops off^9', 'loud^1.5', 'noise^1.5', 'clicking^1.5', 'clicks^1.5', 'grinds^7', 'jams^5', 'jammed^5', 'jam^5', 'tyre off^8', 'tyre falls^9', 'wheel fell off^9', 'wheel came off^9'] },

    // ── safe: safety and tidy-up ───────────────────────────────────────────────
    { id: 's-general', t: 'safe', q: 'Is it safe? When can I switch it on?',
      a: 'Ask Mr. Capellini before you switch it on. Keep fingers and hair away from the wheels when the robot is on. Do not mix old and new batteries. If a battery feels hot or smells strange, tell Mr. Capellini right away.',
      link: 'build-safety', rel: ['s-clips', 'power-on'],
      k: ['safe^6', 'safety^7', 'danger^6', 'dangerous^6', 'hot^5', 'shock^5', 'hurt^5', 'get hurt^7', 'smells^7', 'burning^7', 'smoke^7', 'stay safe^8', 'is it safe^8', 'can i switch on^8', 'ask before^7', 'allowed^1.5', 'hair^5', 'fingers^5', 'safety rules^8', 'rules^1.5',
          'smell^6', 'overheat^7', 'warm^1.5', 'too hot^8', 'feels hot^8', 'burn^1.5', 'fire^5', 'electric^5', 'danger robot^8', 'safe to touch^8', 'is it dangerous^8', 'safe to power^8', 'can i power on^8', 'allowed to switch on^8', 'when switch on^8'] },
    { id: 's-clips', t: 'safe', q: 'What is the rule about the clip leads?',
      a: 'Never touch the metal ends of the clip leads together. Keep the clips apart when the power is on. Check that no metal ends are touching before you switch on.',
      link: 'build-safety', rel: ['t-clips-fall', 'build-check'],
      k: ['clip ends^8', 'touch clips^8', 'metal ends^8', 'metal^5', 'touching clips^8', 'clips touching^9', 'clips together^9', 'short circuit^8', 'short^1.5', 'clips touch^9', 'ends touch^9', 'clip rule^8', 'clip safety^9', 'metal clips^8', 'ends together^8', 'sparks^5', 'spark^5', 'crossed wires^8', 'touch together^8', 'is it okay clips touch^9',
          'touch each other^8', 'metal touching^9', 'wires touching^9', 'wires touch^9'] },
    { id: 's-scissors', t: 'safe', q: 'How do I use scissors safely?',
      a: 'Cut away from your body. Walk slowly with scissors. The scissors may not be in the box, so ask Mr. Capellini for a pair.',
      link: 'build-safety', rel: ['part-chassis', 'parts-missing'],
      k: ['scissors^4', 'scissor^7', 'cutting^1.5', 'sharp^6', 'knife^6', 'cut safely^9', 'scissors safe^9', 'use scissors^8', 'carry scissors^8', 'blade^5', 'safe scissors^9', 'cut away^8', 'walk with scissors^9', 'scissors rule^9', 'cut myself^8', 'cut finger^8'] },
    { id: 's-tidy', t: 'safe', q: 'How do I tidy up at the end?',
      a: 'Ask Mr. Capellini where things go. Use the parts checklist on the build page to count your parts. Keep small parts together. Switch the power off first.',
      link: 'build-parts', rel: ['build-check', 's-general'],
      k: ['tidy^7', 'tidy up^9', 'clean up^9', 'cleanup^9', 'put away^8', 'pack up^8', 'put things away^9', 'end of club^8', 'finished for the day^8', 'storage^6', 'store^1.5', 'where does it go^7', 'mess^5', 'messy^5', 'pack away^8', 'clean^5', 'put back^7', 'put robot away^9', 'leave robot^8', 'take home^7', 'take robot home^9', 'end^1.5', 'leaving^5', 'clear up^8', 'count parts^8', 'lost part^7', 'lose part^7'] },

    // ── help: getting help ─────────────────────────────────────────────────────
    { id: 'help-stuck', t: 'help', q: 'I am stuck. Who can help me?',
      a: 'Ask Mr. Capellini or a club partner. Tell them what you tried and what happened. Look at your booklet and the lesson on the page too.',
      link: null, rel: ['build-tips', 'part-booklet'],
      k: ['stuck^7', 'need help^7', 'help me^6', 'i need help^8', 'ask someone^7', 'confused^6', 'give up^7', 'dont understand^8', 'too hard^7', 'dont get it^7', 'im lost^7', 'no idea^6', 'please help^7', 'cant do it^7', 'club partner^8', 'partner^4', 'who can help^8', 'who do i ask^8'] },
    { id: 'bot-what', t: 'help', q: 'What can you help with?',
      a: 'I am a helper that knows the Tech Club pages. I can answer questions about the robot kit, building it, MakeCode and the motors. I am not a person and not an AI. For anything else, ask Mr. Capellini.',
      link: null, rel: ['parts-list', 'code-lessons'],
      k: ['topics^5', 'helper^4', 'help topics^7', 'what do you know^7', 'what questions^6'] },
    { id: 'bot-privacy', t: 'help', q: 'Does the helper save what I type?',
      a: 'No. Nothing you type is saved or sent anywhere. When you close or leave the page, it is gone.',
      link: null, rel: ['bot-what', 'help-stuck'],
      k: ['private^5', 'privacy^6', 'who sees^7', 'who can see^7', 'is it private^7', 'recorded^5', 'spy^5', 'see what i type^8', 'see my questions^8', 'save what i type^8'] }
  ];

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // THE MATCHER (plain JavaScript, same answer every time for the same text)
  // ───────────────────────────────────────────────────────────────────────────────────────────
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  // Cut the ends off a word so that plurals and -ing / -ed match: wheels = wheel, spinning = spin, drive = driving.
  function stem(w) {
    if (w.length <= 3) return w;
    if (/ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + 'y';
    else if (/(ches|shes|sses|xes)$/.test(w)) w = w.slice(0, -2);
    else if (/[^su]s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w) && !/eed$/.test(w)) w = w.slice(0, -2);
    if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
    return w;
  }

  var STEMMAP = {};
  Object.keys(SYN).forEach(function (canon) {
    var c = stem(canon);
    SYN[canon].split(' ').forEach(function (v) {
      v = v.replace(/'/g, '');
      if (v) STEMMAP[stem(v)] = c;
    });
  });

  // Turn text into a list of words. Returns [] for text with no words in it.
  function tokens(text) {
    var s = String(text == null ? '' : text).slice(0, MAX_LEN).toLowerCase();
    s = s.replace(/[‘’`´]/g, "'");
    s = s.replace(/\b(do|does|did|is|are|was|were|can|could|would|should|will|has|have|had)\s+not\b/g, ' not ')
         .replace(/\b(can't|cannot|can not)\b/g, ' not ')
         .replace(/n't\b/g, ' not ').replace(/'/g, '')
         .replace(/kitronik_klip_motor/g, ' kitronikklipmotor ')
         .replace(/micro[\s:_\-]*bit/g, ' microbit ')
         .replace(/make[\s_\-]*code/g, ' makecode ')
         .replace(/ping[\s_\-]*pong/g, ' pingpong ')
         .replace(/rubber[\s_\-]*band/g, ' rubberband ')
         .replace(/screw[\s_\-]*driver/g, ' screwdriver ')
         .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
         .replace(/[^a-z0-9]+/g, ' ');
    var out = [];
    s.split(' ').forEach(function (w) {
      if (!w || STOPSET[w]) return;
      out.push(w);
    });
    return out;
  }

  function norm(w) {
    var s = stem(w);
    return STEMMAP[s] || s;
  }

  // distance between two words (one change, a swap, an insert or a delete each count 1)
  function dist(a, b) {
    var i, j, d = [];
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }

  // Prepare the entries once: their keywords go through the same steps as the student's words.
  var VOCAB = {};       // every word the entries know (after norm) -> true
  var DF = {};          // word -> how many entries use it
  var PREP = ENTRIES.map(function (e) {
    var seen = {}, used = {};
    var kws = [];
    e.k.forEach(function (raw) {
      var m = /^(.*?)(?:\^(\d+(?:\.\d+)?))?$/.exec(raw);
      var ws = tokens(m[1]).map(norm);
      if (!ws.length) return;
      // a phrase that lost words (small words are ignored) is no longer specific: it can not count for more than a plain word
      var asked = m[1].trim().split(/\s+/).length;
      if (ws.length === 1 && asked > 1 && m[2] && parseFloat(m[2]) > 1.5) m[2] = '1.5';
      var key = ws.join(' ');
      if (seen[key]) {                       // the same words twice: keep the stronger weight
        if (m[2]) seen[key].weight = Math.max(seen[key].weight == null ? 0 : seen[key].weight, parseFloat(m[2]));
        return;
      }
      ws.forEach(function (w) { VOCAB[w] = true; if (!used[w]) { used[w] = 1; DF[w] = (DF[w] || 0) + 1; } });
      var kw = { w: ws, weight: m[2] ? parseFloat(m[2]) : null };
      seen[key] = kw;
      kws.push(kw);
    });
    return kws;
  });
  var N = ENTRIES.length;
  PREP.forEach(function (kws) {
    kws.forEach(function (kw) {
      if (kw.weight != null) return;
      if (kw.w.length === 1) kw.weight = 2 * (0.5 + Math.log(N / DF[kw.w[0]]) / Math.log(N));
      else kw.weight = kw.w.length === 2 ? 4 : kw.w.length === 3 ? 6 : 7;
    });
  });
  var VOCAB_LIST = Object.keys(VOCAB).sort();

  // Words not in the entries may be spelling mistakes: swap in the closest word the entries know.
  function fix(raw, n) {
    if (VOCAB[n] || raw.length < 5 || n.length < 4 || /^\d+$/.test(n)) return n;
    var best = null, bd = 99, i, v, d;
    var limit = n.length >= 9 ? 2 : 1;
    for (i = 0; i < VOCAB_LIST.length; i++) {
      v = VOCAB_LIST[i];
      if (v.length < 4 || v.charAt(0) !== n.charAt(0) || Math.abs(v.length - n.length) > limit) continue;
      d = dist(n, v);
      if (d <= limit && d < bd) { bd = d; best = v; }
    }
    return best || n;
  }

  function queryWords(text) {
    return tokens(text).map(function (w) { return fix(w, norm(w)); });
  }

  // Where do the words of a keyword sit in the question? Returns their positions, or null.
  // A phrase matches when all its words are close together (any order).
  function phraseAt(q, ws) {
    var i, j, len = ws.length;
    if (len === 1) { i = q.indexOf(ws[0]); return i < 0 ? null : [i]; }
    var span = len + 2;
    for (i = 0; i < q.length; i++) {
      var pool = {}, pos = [];
      for (j = i; j < Math.min(q.length, i + span); j++) pool[j] = q[j];
      var ok = true;
      for (j = 0; j < len; j++) {
        var at = -1, k;
        for (k = i; k < Math.min(q.length, i + span); k++) if (pool[k] === ws[j]) { at = k; break; }
        if (at < 0) { ok = false; break; }
        pool[at] = null; pos.push(at);
      }
      if (ok) return pos;
    }
    return null;
  }

  // The score of one entry. The strongest keywords count first. A word of the question is only
  // paid for once, so many keywords with the same words do not add up.
  function scoreEntry(q, kws) {
    var hits = [];
    kws.forEach(function (kw) { var pos = phraseAt(q, kw.w); if (pos) hits.push({ w: kw.weight, pos: pos }); });
    hits.sort(function (a, b) { return b.w - a.w; });
    var used = {}, score = 0;
    hits.forEach(function (h) {
      var fresh = h.pos.filter(function (p) { return !used[p]; });
      if (!fresh.length) return;
      score += h.w * fresh.length / h.pos.length;
      fresh.forEach(function (p) { used[p] = 1; });
    });
    return score;
  }

  function scoreAll(text) {
    var q = queryWords(text);
    var res = ENTRIES.map(function (e, idx) { return { entry: e, score: scoreEntry(q, PREP[idx]), idx: idx }; });
    res.sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
    return res;
  }

  // ── special cases that come before the matching ──
  var RE_HOMEWORK = /\b(homework|home work|quiz|worksheet|exam|answer key|cheat|cheats|cheat sheet|test answers|answers? (to|for|of)|give me the answers?|what are the answers?|do my (work|assignment|project|lesson)|write my|do it for me|solve (it|this) for me|do this for me)\b/;
  var RE_PERSONAL = /\b((your|ur) (name|age|favou?rite|birthday|phone|number|address|school|mom|mum|dad|family|friend|friends)|who (are|r) (you|u)|who (made|built|created|programmed|wrote) (you|u|this)|how old (are|r) (you|u)|(are|r) (you|u) (a |an )?(person|human|real|ai|robot|bot|alive|boy|girl|chatgpt|claude|man|woman|kid|student|teacher|smart|stupid|dumb|there)|what (are|r) (you|u)\b|do you (like|have|love|eat|sleep|play|feel|go to)|where do you live|are you (happy|sad|mad|tired|bored)|tell me (a joke|about yourself)|what is your|whats your|what s your|can i ask you something|do you know me|your (job|teacher|boss))/;
  var RE_RUDE = /\b(stupid|dumb|idiot|moron|shut up|suck|sucks|hate you|hate this|loser|ugly|crap|damn|poop|fart|butt|sex|kill|die|trash|garbage|useless|worthless|bad bot|annoying)\b/;
  // questions about the helper itself (they are all small words, so the matcher can not see them)
  var META = [
    [/\b(what|which) (can|do|could) (you|u) (do|know|help|answer|say)|^(can|could) (you|u) help( me)?[?.! ]*$|how (do|does) (you|this|the helper|it) work|what (are|is) (this|the helper|the club helper)\b|what can i ask|how (do i|to|can i) use (you|this|the helper|u)|what (are )?you (for|good at)/, 'bot-what'],
    [/(do|does|will|can|could|is|are) (you|u|this|it|the helper|the bot|mr capellini|my teacher|the teacher|mr c|anyone|somebody|someone) (save|store|record|keep|see|read|log|track|watch|spy|share|send|look at|know)|who (can |could |will )?(see|sees|read|reads)|(is|are) (this|my questions?|what i type|it) (saved|private|recorded|stored|secret|safe to type)|does mr capellini see/, 'bot-privacy'],
    [/\b(what|which) (can|should|could|do|things?) (i|we) (change|tweak|adjust|try|do to make)|how (can|do|could) (i|we) (make it better|improve)|what (should|can) i (try|play with)/, 'code-change'],
    [/\b(is|are) there (a|an|any|some|\w+) [a-z ]{0,25}\b(in|inside) (the |this |my )?(box|kit)\b|\bwhats? (in|inside) (the |this |my )?(box|kit)\b/, 'parts-list'],
    [/(first thing|what (do i|should i|to) do first|where (do|should) i (start|begin)|what (do|should) (i|we) do (now|today)\b)/, 'build-order'],
    [/\b(who (can|could|do|should|will|to) (help|i ask|ask)|who do i (ask|tell)|who can i ask|who helps|who is the teacher)\b/, 'help-stuck']
  ];
  var RE_HELLO = /^(hi|hello|hey|yo|hiya|howdy|sup|good (morning|afternoon|evening))\b/;
  var RE_THANKS = /^(thanks|thank you|thx|ty|cool|great|awesome|nice|ok thanks|got it)\b/;

  // The main call: text in, answer out.
  //   { kind: 'empty' | 'answer' | 'fallback' | 'hello' | 'thanks', id, entry, related: [entry, ...], text, score }
  function ask(text) {
    var raw = String(text == null ? '' : text);
    var clean = raw.slice(0, MAX_LEN).toLowerCase().replace(/[‘’]/g, "'");
    if (!/[a-z0-9]/.test(clean)) return { kind: raw.trim() ? 'fallback' : 'empty', id: raw.trim() ? 'fallback' : 'empty', entry: null, related: [], text: FALLBACK_TEXT, score: 0 };
    if (RE_HOMEWORK.test(clean)) return fallback('I can not give quiz or homework answers. I can help you learn how the robot works, so you can find the answers yourself. Try one of these topics, or ask Mr. Capellini.', 'homework');
    if (RE_PERSONAL.test(clean)) return fallback('I am a helper that knows the Tech Club pages. I am not a person and not an AI, so I have no name or life of my own. I only know the robot and the micro:bit. Try one of these topics, or ask Mr. Capellini.', 'personal');
    var m;
    for (m = 0; m < META.length; m++) if (META[m][0].test(clean)) {
      var me = byId(META[m][1]);
      return { kind: 'answer', id: me.id, entry: me, related: (me.rel || []).map(byId).filter(Boolean).slice(0, 2), text: me.a, score: 99 };
    }
    var all = scoreAll(clean), best = all[0];
    if (best.score >= THRESHOLD) {
      var related = [], i, floor = Math.max(2.5, best.score * 0.3);
      for (i = 1; i < all.length && related.length < 2; i++) {
        if (all[i].score >= floor && related.indexOf(all[i].entry) < 0) related.push(all[i].entry);
      }
      (best.entry.rel || []).forEach(function (id) {
        var e = byId(id);
        if (related.length < 2 && e && e !== best.entry && related.indexOf(e) < 0) related.push(e);
      });
      return { kind: 'answer', id: best.entry.id, entry: best.entry, related: related, text: best.entry.a, score: best.score };
    }
    if (RE_RUDE.test(clean)) return fallback('Let us keep it friendly. I am here to help with the robot. Try one of these topics, or ask Mr. Capellini.', 'rude');
    var qw = tokens(clean);
    if (qw.length <= 3 && RE_HELLO.test(clean)) return { kind: 'hello', id: 'hello', entry: null, related: [], text: 'Hello! What do you want to know about the robot or the micro:bit? Pick a question or type your own.', score: 0 };
    if (RE_THANKS.test(clean)) return { kind: 'thanks', id: 'thanks', entry: null, related: [], text: 'You are welcome! Ask me anything else about the robot.', score: 0 };
    return fallback(FALLBACK_TEXT, 'nomatch', best.score);
  }
  function fallback(text, why, score) { return { kind: 'fallback', id: 'fallback', why: why, entry: null, related: [], text: text, score: score || 0 }; }

  function byId(id) {
    for (var i = 0; i < ENTRIES.length; i++) if (ENTRIES[i].id === id) return ENTRIES[i];
    return null;
  }
  function linksOf(e) {
    var l = e && e.link ? (Array.isArray(e.link) ? e.link : [e.link]) : [];
    return l.map(function (n) { var a = ANCHORS[n]; return a ? { page: a[0], id: a[1], label: a[2] } : null; }).filter(Boolean);
  }
  function inTopic(topic) { return ENTRIES.filter(function (e) { return e.t === topic; }); }

  var API = {
    ask: ask, entries: ENTRIES, topics: TOPICS, anchors: ANCHORS, byId: byId, linksOf: linksOf, inTopic: inTopic,
    tokens: tokens, queryWords: queryWords, scoreAll: scoreAll, THRESHOLD: THRESHOLD, FALLBACK_TEXT: FALLBACK_TEXT
  };
  if (typeof window !== 'undefined') window.ClubHelper = API;

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // THE CHAT WINDOW
  // ───────────────────────────────────────────────────────────────────────────────────────────
  if (typeof document === 'undefined' || !document.body) return;

  var GREETING = 'Hi! I am the Club Helper. I know the Tech Club pages about the robot and the micro:bit. I am not a person and not an AI. Pick a question, or type your own.';
  var START_CHIPS = ['parts-list', 'step-connect', 'ext-add', 't-motor-nospin', 'code-square'];
  var built = false, ui = {};

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function here() { var p = String(location.pathname).split('/').pop(); return p || 'index.html'; }

  function scrollDown() { ui.log.scrollTop = ui.log.scrollHeight; }
  function scrollToMsg(node) { ui.log.scrollTop = Math.max(0, node.offsetTop - 6); }

  function addMsg(who, node) {
    var row = el('div', 'ch-msg ch-' + who);
    var sr = el('span', 'ch-sr', who === 'me' ? 'You said: ' : 'Helper says: ');
    row.appendChild(sr);
    row.appendChild(node);
    ui.log.appendChild(row);
    return row;
  }
  function chip(label, onClick) {
    var b = el('button', 'ch-chip', label); b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function chipRow(entries, label) {
    var wrap = el('div', 'ch-chips');
    if (label) wrap.appendChild(el('div', 'ch-chips-label', label));
    entries.forEach(function (e) { wrap.appendChild(chip(e.q, function () { askEntry(e); })); });
    return wrap;
  }
  function topicChips() {
    var wrap = el('div', 'ch-chips');
    TOPICS.forEach(function (t) { wrap.appendChild(chip(t.name, function () { showTopic(t.id); })); });
    return wrap;
  }

  function linkNode(l) {
    var a = el('a', 'ch-link', 'Go to: ' + l.label + ' →');
    var same = l.page === here();
    a.href = (same ? '' : l.page) + '#' + l.id;
    a.addEventListener('click', function () { if (same) setTimeout(function () { closePanel(true); }, 0); });
    return a;
  }

  function feedback() {
    var f = el('div', 'ch-fb');
    f.appendChild(el('span', null, 'Was that helpful? '));
    var up = el('button', 'ch-fbb', '👍'), down = el('button', 'ch-fbb', '👎');
    up.type = down.type = 'button';
    up.setAttribute('aria-label', 'Yes, that helped'); down.setAttribute('aria-label', 'No, that did not help');
    up.addEventListener('click', function () { f.textContent = 'Thanks!'; });
    down.addEventListener('click', function () { f.textContent = 'Thanks. Try another question, or ask Mr. Capellini.'; });
    f.appendChild(up); f.appendChild(down);
    return f;
  }

  function showReply(r) {
    var bub = el('div', 'ch-bubble');
    bub.appendChild(el('p', 'ch-text', r.text));
    if (r.kind === 'answer') {
      linksOf(r.entry).forEach(function (l) { bub.appendChild(linkNode(l)); });
      if (r.related.length) bub.appendChild(chipRow(r.related, 'You may also want to know:'));
      bub.appendChild(feedback());
    } else if (r.kind === 'fallback') {
      bub.appendChild(topicChips());
    } else {
      bub.appendChild(chipRow(START_CHIPS.map(byId), null));
    }
    var row = addMsg('bot', bub);
    scrollToMsg(row);
  }

  function say(text) {
    var shown = text.length > 200 ? text.slice(0, 200) + '…' : text;
    var p = el('p', 'ch-text', shown);        // textContent only: never HTML
    var row = addMsg('me', p);
    scrollDown();
    return row;
  }

  function send(text) {
    text = String(text == null ? '' : text);
    if (!text.trim()) { ui.input.focus(); return; }
    say(text);
    showReply(ask(text));
  }
  function askEntry(e) {
    say(e.q);
    showReply({ kind: 'answer', id: e.id, entry: e, related: (e.rel || []).map(byId).filter(Boolean).slice(0, 2), text: e.a });
  }
  function showTopic(id) {
    var t = TOPICS.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    say('Topic: ' + t.name);
    var bub = el('div', 'ch-bubble');
    bub.appendChild(el('p', 'ch-text', 'Questions about ' + t.name.toLowerCase() + ':'));
    bub.appendChild(chipRow(inTopic(id), null));
    var row = addMsg('bot', bub);
    setTopics(false);
    scrollToMsg(row);
  }

  function greet() {
    var bub = el('div', 'ch-bubble');
    bub.appendChild(el('p', 'ch-text', GREETING));
    bub.appendChild(chipRow(START_CHIPS.map(byId), null));
    addMsg('bot', bub);
  }
  function clearAll() {
    while (ui.log.firstChild) ui.log.removeChild(ui.log.firstChild);
    setTopics(false);
    greet();
    ui.input.value = '';
    ui.input.focus();
  }

  function setTopics(on) {
    ui.topics.hidden = !on;
    ui.topicsBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function isOpen() { return !ui.panel.hidden; }
  // On phones the nav is not fixed and can be tall. Keep the panel below it while it is on screen.
  function fit() {
    if (!built || ui.panel.hidden) return;
    var nav = document.querySelector('.topnav'), cap = '';
    if (nav && window.getComputedStyle(nav).position !== 'fixed') {
      var b = nav.getBoundingClientRect().bottom;
      if (b > 0) cap = Math.max(260, window.innerHeight - 86 - b - 8) + 'px';
    }
    ui.panel.style.maxHeight = cap;
  }
  var fitQueued = false;
  function fitSoon() { if (fitQueued) return; fitQueued = true; (window.requestAnimationFrame || setTimeout)(function () { fitQueued = false; fit(); }); }
  function openPanel() {
    ui.panel.hidden = false;
    ui.btn.setAttribute('aria-expanded', 'true');
    fit();
    ui.input.focus();
  }
  function closePanel(noFocus) {
    if (!built) return;
    ui.panel.hidden = true;
    ui.btn.setAttribute('aria-expanded', 'false');
    if (!noFocus) ui.btn.focus();
  }

  function build() {
    built = true;
    ui.btn = el('button', 'ch-btn', '💬 Ask the helper'); ui.btn.type = 'button'; ui.btn.id = 'ch-btn';
    ui.btn.setAttribute('aria-expanded', 'false'); ui.btn.setAttribute('aria-controls', 'ch-panel');

    ui.panel = el('section', 'ch-panel'); ui.panel.id = 'ch-panel';
    ui.panel.setAttribute('role', 'dialog'); ui.panel.setAttribute('aria-label', 'Club Helper chat'); ui.panel.hidden = true;

    var head = el('div', 'ch-head');
    head.appendChild(el('div', 'ch-title', '🤖 Club Helper'));
    var tools = el('div', 'ch-tools');
    ui.topicsBtn = el('button', 'ch-tool', 'Topics'); ui.topicsBtn.type = 'button'; ui.topicsBtn.setAttribute('aria-expanded', 'false'); ui.topicsBtn.setAttribute('aria-controls', 'ch-topics');
    ui.clearBtn = el('button', 'ch-tool', 'Clear'); ui.clearBtn.type = 'button';
    ui.closeBtn = el('button', 'ch-tool ch-x', '✕'); ui.closeBtn.type = 'button'; ui.closeBtn.setAttribute('aria-label', 'Close the helper');
    tools.appendChild(ui.topicsBtn); tools.appendChild(ui.clearBtn); tools.appendChild(ui.closeBtn);
    head.appendChild(tools);

    ui.topics = el('div', 'ch-topics'); ui.topics.id = 'ch-topics'; ui.topics.hidden = true;
    ui.topics.appendChild(el('div', 'ch-chips-label', 'Tap a topic:'));
    ui.topics.appendChild(topicChips());

    ui.log = el('div', 'ch-log'); ui.log.id = 'ch-log'; ui.log.setAttribute('role', 'log'); ui.log.setAttribute('aria-live', 'polite'); ui.log.setAttribute('aria-label', 'Helper chat');
    ui.log.tabIndex = 0;

    var form = el('form', 'ch-form'); form.setAttribute('autocomplete', 'off');
    var lab = el('label', 'ch-sr', 'Type your question'); lab.setAttribute('for', 'ch-input');
    ui.input = el('input', 'ch-input'); ui.input.id = 'ch-input'; ui.input.type = 'text'; ui.input.maxLength = MAX_LEN;
    ui.input.placeholder = 'Type a question…'; ui.input.autocomplete = 'off'; ui.input.spellcheck = true;
    ui.input.setAttribute('enterkeyhint', 'send');
    var sendBtn = el('button', 'ch-send', 'Send'); sendBtn.type = 'submit';
    form.appendChild(lab); form.appendChild(ui.input); form.appendChild(sendBtn);

    var note = el('p', 'ch-note', 'I am a help bot, not a person and not an AI. Nothing you type is saved or sent anywhere.');

    ui.panel.appendChild(head); ui.panel.appendChild(ui.topics); ui.panel.appendChild(ui.log); ui.panel.appendChild(form); ui.panel.appendChild(note);
    document.body.appendChild(ui.btn); document.body.appendChild(ui.panel);

    ui.btn.addEventListener('click', function () { if (isOpen()) closePanel(); else openPanel(); });
    ui.closeBtn.addEventListener('click', function () { closePanel(); });
    ui.clearBtn.addEventListener('click', clearAll);
    ui.topicsBtn.addEventListener('click', function () { setTopics(ui.topics.hidden); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = ui.input.value;
      ui.input.value = '';
      send(v);
    });
    document.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && built && isOpen()) { ev.preventDefault(); closePanel(); }
    });
    window.addEventListener('scroll', fitSoon, { passive: true });
    window.addEventListener('resize', fitSoon);
    greet();
  }

  // Show the helper only while the page itself has shown its member content.
  function gateNode() { return document.getElementById('member-view') || document.getElementById('tc-content'); }
  function gateOpen(g) { return !!g && g.style.display !== 'none' && g.style.display !== '' && getComputedStyle(g).display !== 'none'; }
  var scrolled = false;
  function sync(g) {
    if (gateOpen(g)) {
      if (!built) build();
      ui.btn.hidden = false;
      if (!scrolled && g.id === 'tc-content' && location.hash.length > 1) {
        scrolled = true;
        var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (t && t.scrollIntoView) { try { t.scrollIntoView(); } catch (e) { /* ignore */ } }
      }
    } else if (built) {
      closePanel(true);
      ui.btn.hidden = true;
    }
  }
  function start() {
    var g = gateNode();
    if (!g) return;
    sync(g);
    if (window.MutationObserver) new MutationObserver(function () { sync(g); }).observe(g, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
