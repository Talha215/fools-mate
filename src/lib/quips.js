// Deep Blunder's running commentary.
const QUIPS = {
  hello: [
    "Hello! I've studied chess for 0 hours.",
    "I'm ready. Which way do the horsies go again?",
    "Let's have a good game. Or a game, at least.",
    "My creator says I'm 'very random'. I think it's a compliment.",
  ],
  thinking: [
    'Calculating…',
    'Consulting the dice…',
    'Counting on my fingers…',
    'Thinking really, really hard…',
    'Asking the magic 8-ball…',
    'Hmm, hmm, hmm…',
    'Shuffling the moves…',
  ],
  move: [
    'Hmm. Yes. That one.',
    'I picked this one with my eyes closed.',
    "I'm playing the long game. Very long. Possibly infinite.",
    'Calculation complete. Result: vibes.',
    'Grandmasters hate this one weird trick.',
    'I saw this move in a dream once.',
    'Trust the process.',
    'Every move is a winning move if you believe.',
    "My coach calls me 'unpredictable'.",
    'Bold. Brave. Probably bad.',
    'Did I just hang something? Don’t tell me.',
    "That's what Magnus would do. I assume.",
    'I have no idea what I just did.',
    'Positional sacrifice. Of my dignity.',
    'Book move. The book is upside down.',
  ],
  capture: ['Ooh, free stuff!', 'Yoink.', 'Was that piece important?', 'Om nom nom.', 'Mine now.'],
  check: [
    "Check! …that's good, right?",
    'Your king looks nervous.',
    "Check! I've never been this close.",
    'Is it checkmate? No? Darn.',
  ],
  castle: ['My king needs a nap behind those pawns.', 'Castling! I read about this once.'],
  promote: ['A new piece! Not sure which one I picked.', 'Promotion! I earned this.'],
  underpromote: ['A knight! Queens are overrated.', 'Underpromotion. The sophisticated choice.'],
  missedMate: [
    'Was there something there?',
    'I sensed a disturbance in the force… nah.',
    "Mate? Like a friend? Hi friend!",
    'So close. I think? I genuinely do not know.',
    'Checkmate was RIGHT there, wasn’t it.',
  ],
  ignoredQueen: ["I didn't want your queen anyway.", 'Your queen is safe. For now. Probably forever.'],
  inCheck: ['Ow!', 'Hey! Rude.', 'My king is fine. Totally fine.', 'Excuse me??'],
  botWins: [
    'I… WON? Mom, get the camera!',
    'Checkmate! I would like to thank my random number generator.',
    'Is this what winning feels like? I need to sit down.',
  ],
  playerWins: [
    'Wait, you were supposed to lose. I mean… I was supposed to win.',
    'This is embarrassing for both of us.',
    'You beat the worst chess player in the world. Congrats?',
  ],
  draw: ["A draw? Even I can't believe it.", 'We both lose! Kind of.', 'Nobody wins. My favourite result.'],
  resign: ['You… gave up on losing? Respect.', 'Leaving so soon? I was just warming up.'],
};

const last = {};
export function quip(kind) {
  const list = QUIPS[kind] || QUIPS.move;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[kind]) i = (i + 1) % list.length;
  last[kind] = i;
  return list[i];
}
