// His activity book (Binoy, Nov 3: "think of many categories of activities that mochi can have basic information of,
// so that when a user suggests an activity, mochi would be able to perform it").
//
// Every entry is made from things his body already has: a prop in his hooves or on his head (his pocket, including the
// new things in shared/pocket-more.js), a thing set down beside him for the activity (a drum, a cooking pot, a tent),
// motions (shared/motions.js), faces, little effects (notes, stars, hearts, steam), a sound (web/party.js), and
// Mimi and Cocoa joining in. The server turns an entry into a timed routine (server/book.js) and the kit plays it
// (kit/src/activities.js, kind "routine"). Anything not in the book, Gemma improvises from the same pieces.
//
// An entry: { id, cat, name (what you'd ask), ing (what he's doing, for the brain), w (the words that ask for it),
//   hold / wear / set (pocket names; pick: [[regex, name]] chooses the held thing from the words), moves, fx, sound,
//   friends (who comes by default), role, copy (friends copy his moves), fsay [who, line], lines [start, end], end
//   (his face at the end), stand (he stands up for it), steps (an explicit script instead of moves), brief (what the
//   brain is told to say, for a talk entry; never shown) }.

export const CATEGORIES = [
  ["music", "Music"], ["dance", "Dancing"], ["exercise", "Exercise"], ["sport", "Sports & games"], ["art", "Arts & making"],
  ["food", "Cooking & food"], ["learn", "Reading & learning"], ["nature", "Outdoors & nature"], ["pretend", "Pretend & jobs"],
  ["care", "Chores & taking care"], ["party", "Celebrations"], ["tech", "Gadgets"],
];

const A = (id, cat, name, ing, w, o = {}) => ({ id, cat, name, ing, w: new RegExp(`\\b(?:${w})\\b`), ...o });
const FOOD = [[/pizza/, "pizza slice"], [/cookie|biscuit/, "cookie"], [/apple|fruit/, "apple"], [/ice ?cream/, "ice cream"], [/cupcake|muffin|cake/, "cupcake"], [/popcorn/, "popcorn"], [/soup/, "soup"]];
const DRINK = [[/cocoa|hot chocolate|chocolate/, "hot cocoa"], [/tea/, "tea"]];

export const BOOK = [
  // ---------------------------------------------------------------- music
  A("guitar", "music", "play the guitar", "playing your guitar", "play (?:the |a |your |some )?guitar|play (?:[a-z']+ ){0,4}on (?:the |a |your )?guitar|strum (?:your |the |a )?guitar|guitar (?:song|solo)|strum something",
    { hold: "guitar", moves: ["strum", "strum"], fx: "note", sound: "guitar", role: "dance", lines: ["🎵 Strum strum strum!", "Thank you, thank you!"], end: "proud" }),
  A("drums", "music", "play the drums", "playing your toy drum", "play (?:the |a |your |some )?drums?|bang (?:on )?(?:the |a |your )?drums?|drum (?:roll|solo)|be a drummer|do a drumroll",
    { set: "toy drum", moves: ["drum", "drum"], fx: "note", sound: "drums", role: "dance", lines: ["Ba-dum, ba-dum!", "Ba-dum-TSSS!"], end: "excited" }),
  A("piano", "music", "play the piano", "playing your little piano", "play (?:the |a |your |some )?(?:piano|keyboard)|play (?:[a-z']+ ){0,4}on (?:the |a |your )?piano|piano (?:song|music)|be a pianist",
    { set: "little piano", moves: ["piano", "piano"], fx: "note", sound: "piano", lines: ["Plink plonk…", "That one's called Fluffy Clouds!"], end: "proud" }),
  A("sing", "music", "sing a song", "singing into your microphone", "sing(?:ing)?|(?:do|have) (?:a |some )?(?:karaoke|singing)|karaoke|serenade|a song for (?:me|us|mimi|cocoa)",
    { hold: "microphone", moves: ["sing", "sing"], fx: "note", sound: "sing", role: "dance", lines: ["🎵 La la laaa!", "🎵 …and that's my song!"], end: "proud" }),
  A("trumpet", "music", "play the trumpet", "tooting your toy trumpet", "play (?:the |a |your )?(?:trumpet|horn|bugle|tuba|trombone|saxophone|sax)|toot (?:your |the |a )?(?:trumpet|horn)",
    { hold: "toy trumpet", moves: ["blow", "march"], fx: "note", sound: "trumpet", lines: ["Toot toot!", "Ta-taaa!"], end: "proud" }),
  A("maracas", "music", "shake the maracas", "shaking your maraca", "(?:play|shake) (?:the |a |your |some )?maracas?|maracas?|shake (?:it|something) to (?:the )?music",
    { hold: "maraca", moves: ["shake", "hula"], fx: "note", sound: "maracas", role: "dance", lines: ["Chk-chk-chk!", "Olé!"], end: "excited" }),
  A("dj", "music", "be a DJ", "DJing with your headphones on", "be (?:a|the|our) dj|dj (?:for us|a set|some music)|play (?:some )?music|drop (?:a|the) beat|make (?:a |some )?beats?|beatbox",
    { wear: "magenta headphones", moves: ["dj", "dj"], fx: "note", sound: "beat", role: "dance", lines: ["Untz untz untz!", "DJ Mochi in the house!"], end: "showoff" }),
  A("conduct", "music", "conduct an orchestra", "conducting an orchestra with a pencil", "conduct (?:an |the |a )?(?:orchestra|band|music|choir)|be (?:a|the) conductor",
    { hold: "pencil", moves: ["conduct", "conduct"], fx: "note", sound: "piano", lines: ["And… violins!", "Bravo, bravo!"], end: "proud", stand: true }),
  A("listen", "music", "listen to music", "listening to music on your headphones", "listen to (?:some |a |the )?(?:music|songs?|tunes)|put on (?:some )?music|chill (?:out )?to (?:some )?music",
    { wear: "magenta headphones", moves: ["hula", "meditate"], fx: "note", sound: "sing", lines: ["Ooh, I love this one…", "Mmm. Good song."], end: "love" }),

  // ---------------------------------------------------------------- dancing (a plain "dance" is his dance party)
  A("ballet", "dance", "do ballet", "doing ballet", "(?:do|dance) (?:some |a )?ballet|ballerina|pirouette|twirl like a",
    { wear: "flower crown", moves: ["stretch", "spin", "bow"], fx: "star", sound: "piano", role: "cheer", copy: true, lines: ["And… twirl!", "Merci, merci!"], end: "proud", stand: true }),
  A("hula", "dance", "do the hula", "dancing the hula", "(?:do|dance) (?:the |a )?hula|hula dance|hula|luau",
    { wear: "flower crown", moves: ["hula", "hula"], fx: "heart", sound: "guitar", role: "dance", copy: true, lines: ["Aloha!", "Mahalo!"], end: "love", stand: true }),
  A("robot", "dance", "do the robot", "doing the robot dance", "(?:do|dance) the robot|robot dance|dance like a robot|move like a robot|be a robot",
    { moves: ["robot", "robot"], fx: "star", sound: "beat", role: "dance", copy: true, lines: ["Beep. Boop. Dancing.", "Robot… mode… off!"], end: "laugh", stand: true }),
  A("cheerlead", "dance", "be a cheerleader", "cheerleading", "be (?:a|my|our) cheerleader|cheerlead|(?:do|give me) (?:a |some )?cheers?|cheer (?:me|us|for (?:me|us))(?: on)?",
    { moves: ["cheer", "hop", "cheer"], fx: "confetti", role: "cheer", copy: true, lines: ["Gimme an M!", "Gooo team!"], end: "superexcited", stand: true }),
  A("march", "dance", "march like a soldier", "marching like a toy soldier", "march(?:ing)?(?: around| like| in)?|(?:do|have) a (?:little )?parade|be a toy soldier",
    { hold: "toy trumpet", moves: ["march", "march", "salute"], fx: "star", sound: "drums", role: "cheer", copy: true, lines: ["Left, right, left!", "Atten-hut!"], end: "proud", stand: true }),

  // ---------------------------------------------------------------- exercise
  A("jacks", "exercise", "do jumping jacks", "doing jumping jacks", "(?:do |some )?jumping jacks|star jumps|work ?out(?! (?:a|an|the|how|what|why|if|this|that|my|your|our|whether|who|where|which|when)\\b)|exercise|get (?:some )?exercise|do (?:some )?(?:cardio|aerobics|pe)",
    { moves: ["jacks", "jacks"], fx: "star", sound: "beat", role: "play", copy: true, lines: ["One! Two! One! Two!", "Phew! Feel the burn!"], end: "proud", stand: true }),
  A("yoga", "exercise", "do yoga", "doing yoga", "(?:do|try) (?:some )?yoga|yoga|downward dog|tree pose",
    { moves: ["stretch", "meditate"], fx: "orbit", sound: "chime", role: "comfort", copy: true, lines: ["Breathe in…", "…and breathe out. Namaste."], end: "love", stand: true }),
  A("stretch", "exercise", "stretch", "stretching", "stretch(?:es|ing)?(?= *(?:$|[!.?]|with|together|out|a bit|for me))|(?:do|have) a (?:big |good )?stretch|warm ?up(?= *(?:$|[!.?]|with|together|first))|limber up",
    { moves: ["stretch", "stretch"], fx: "star", lines: ["Mmmmh… stretchy!", "Ahh, that's better."], end: "happy", stand: true }),
  A("karate", "exercise", "do karate", "doing karate", "(?:do|show me) (?:some |a )?(?:karate|kung ?fu|taekwondo|judo|martial arts)|karate(?: chop)?|kung ?fu|ninja moves|be a ninja|hi-?yah",
    { moves: ["karate", "karate", "bow"], fx: "bang", sound: "whoosh", role: "ready", copy: true, lines: ["Hi-YAH!", "*bows* Thank you, sensei."], end: "proud", stand: true }),
  A("meditate", "exercise", "meditate", "meditating", "meditat(?:e|ing|ion)|be (?:calm|zen|mindful)|(?:take|do) (?:a few |some )?deep breaths|breathe with me|find your zen|relax with me",
    { moves: ["meditate", "meditate"], fx: "orbit", sound: "chime", role: "comfort", lines: ["Ommmmm…", "I feel so calm."], end: "love" }),
  A("swim", "exercise", "go swimming", "swimming in your swim ring", "(?:go |let'?s go )?swim(?:ming)?|(?:go|jump) (?:in|into) the (?:pool|water|sea|lake)|do the (?:doggy|sheepy) paddle|paddle",
    { wear: "swim ring", moves: ["swim", "swim"], fx: "snow", sound: "splash", role: "play", lines: ["Splish splash!", "The water's lovely!"], end: "excited" }),
  A("hop", "exercise", "jump around", "hopping and bouncing", "(?:jump|hop|bounce) (?:around|up and down|on the spot)|jump rope|skip(?:ping)? rope|hopscotch|bunny hops?",
    { moves: ["hop", "hop"], fx: "star", sound: "boing", role: "play", copy: true, lines: ["Boing! Boing!", "Phew, bouncy!"], end: "excited", stand: true }),
  A("race", "exercise", "have a race", "racing Cocoa across the stage", "(?:have|run) a race|race (?:me|you|cocoa|mimi|each other)|let'?s race|go for a run|run (?:around|fast)|jog(?:ging)?",
    { friends: ["cocoa"], role: "play", steps: [["fsay", "cocoa", "Ready… set…"], ["say", "GO!"], ["walk", 1.3], ["fx", "star", 5], ["face", "laugh", 1600], ["say", "I win! …I think?"]] }),

  // ---------------------------------------------------------------- sports & games
  A("soccer", "sport", "play soccer", "kicking your soccer ball", "(?:play|kick) (?:some |a |the )?(?:soccer|football|footy)(?: ball)?|score a goal|kick (?:a|the) ball",
    { hold: "soccer ball", steps: [["move", "kick"], ["toss", "viewer"], ["fx", "confetti", 6], ["sound", "cheer"], ["say", "GOOOAL!"], ["move", "cheer"]], role: "cheer", end: "superexcited" }),
  A("basketball", "sport", "shoot hoops", "shooting hoops with your basketball", "(?:play|shoot) (?:some )?(?:basketball|hoops)|basketball|slam dunk|dunk it|make a basket",
    { hold: "basketball", steps: [["move", "shoot"], ["toss", "up"], ["fx", "star", 5], ["sound", "swish"], ["say", "Swish!"], ["move", "cheer"]], role: "cheer", end: "proud" }),
  A("tennis", "sport", "play tennis", "playing tennis", "(?:play|hit) (?:some )?(?:tennis|badminton|ping ?pong|table tennis)|tennis|swing (?:a |the |your )?racket",
    { hold: "tennis racket", moves: ["swing", "swing"], fx: "star", sound: "pock", role: "cheer", lines: ["Thwock!", "Ace!"], end: "proud" }),
  A("bowling", "sport", "go bowling", "bowling", "(?:go |let'?s go )?bowling|bowl (?:a|some)|knock (?:down|over) (?:the |some )?pins|get a strike",
    { set: "bowling pins", hold: "foam ball", steps: [["move", "throw"], ["toss", "set"], ["knock"], ["sound", "strike"], ["fx", "confetti", 6], ["say", "STRIKE!"]], role: "cheer", end: "superexcited" }),
  A("catch", "sport", "play catch", "playing catch with Cocoa", "play (?:a game of )?catch|throw (?:the|a) ball (?:to|with|back and forth)|toss (?:the|a) ball|catch the ball",
    { friends: ["cocoa"], role: "ready", hold: "foam ball", steps: [["say", "Catch, Cocoa!"], ["catch", "cocoa", 3], ["fsay", "cocoa", "Nice throw!"]], end: "laugh" }),
  A("hide", "sport", "play hide and seek", "playing hide and seek with Cocoa", "(?:play )?hide (?:and|n|&) (?:go )?seek|hide ?and ?seek",
    { friends: ["cocoa"], role: "play", steps: [["fsay", "cocoa", "You count!"], ["move", "peekaboo"], ["say", "1… 2… 3…"], ["bye", "cocoa"], ["wait", 1800], ["say", "…10! Ready or not!"], ["move", "sneak"], ["friend", "cocoa", "giggle"], ["fsay", "cocoa", "BOO!"], ["face", "surprised", 1400], ["say", "Found you!"], ["fx", "star", 4]], end: "laugh" }),
  A("peekaboo", "sport", "play peekaboo", "playing peekaboo", "(?:play )?peek-?a-?boo",
    { moves: ["peekaboo", "peekaboo"], fx: "heart", lines: ["Where's Mochi?", "Peekaboo!"], end: "laugh" }),
  A("tag", "sport", "play tag", "playing tag with Cocoa", "play tag|tag,? you'?re it|you'?re it|chase (?:me|cocoa|mimi|each other)|let'?s play chase|play chase",
    { friends: ["cocoa"], role: "play", steps: [["say", "Tag, you're it!"], ["hop"], ["walk", 1.2], ["fsay", "cocoa", "Hey, come back!"], ["face", "laugh", 1600]], end: "laugh" }),
  A("sword", "sport", "have a sword fight", "sword fighting with your foam sword", "(?:have a |do a )?(?:sword ?fight|swordfight|fencing|duel)|swing (?:a |your )?sword|play (?:knights|pirates)",
    { hold: "foam sword", moves: ["swing", "swing", "salute"], fx: "star", sound: "whoosh", friends: ["cocoa"], role: "ready", fsay: ["cocoa", "En garde!"], lines: ["Have at thee!", "A fine duel, sir Cocoa!"], end: "proud" }),
  A("videogame", "sport", "play a video game", "playing a game on your phone", "play (?:a |some )?(?:video ?games?|computer games?|games? on (?:your|the) phone|mario|minecraft)|video ?games?|gaming",
    { hold: "magenta smartphone", moves: ["gamepad", "gamepad"], fx: "star", sound: "bleeps", lines: ["Jump! Jump! Yesss!", "New high score!"], end: "superexcited" }),
  A("game", "sport", "play a game", "playing a game", "play (?:a |some |another )?(?:fun |little )?games?(?! on )|play something(?: fun)?|let'?s play(?=[!.\\s]*$)",
    { pickOne: ["catch", "hide", "peekaboo", "tag", "soccer", "bowling"] }),

  // ---------------------------------------------------------------- arts & making (painting has its own easel)
  A("photo", "art", "take photos", "taking photos with your camera", "take (?:a |some |my |our )?(?:photos?|pictures?|pics?|snaps?)(?! of a)|photograph(?:y|s)?|say cheese",
    { hold: "camera", steps: [["move", "photo"], ["sound", "click"], ["fx", "star", 4], ["say", "Say cheese!"], ["move", "photo"], ["sound", "click"]], end: "proud" }),
  A("selfie", "art", "take a selfie", "taking a selfie", "(?:take|snap) (?:a |some )?selfies?|selfie",
    { hold: "magenta smartphone", steps: [["move", "selfie"], ["sound", "click"], ["fx", "star", 4]], role: "showoff", lines: ["Cheese!"], end: "showoff" }),
  A("write", "art", "write a poem", "writing in your notebook with your pencil", "write (?:me |us )?(?:a |an |some )?(?:poem|story|letter|song|note|haiku|card)|(?:make|compose) (?:a |me a )?(?:poem|haiku)",
    { talk: true, hold: "pencil", moves: ["write", "think", "write"], fx: "heart", lines: ["Hmm… what rhymes with fluffy?", "Done! Want to hear it?"], end: "proud" }),
  A("snowman", "art", "build a snowman", "building a snowman", "(?:build|make) (?:a |me a |us a )?snow ?man|snowman",
    { set: "snowman", moves: ["pat", "pat"], fx: "snow", sound: "whoosh", role: "play", lines: ["Pat pat pat…", "Meet Mr Frosty!"], end: "proud" }),
  A("sandcastle", "art", "build a sandcastle", "building a sandcastle", "(?:build|make) (?:a |me a |us a )?sand ?castle|sandcastle|play in the sand",
    { hold: "little trowel", set: "sandcastle", moves: ["dig", "pat"], fx: "star", role: "play", lines: ["Dig dig dig…", "Ta-da! A castle!"], end: "proud" }),
  A("build", "art", "build something", "hammering away with your toy hammer", "hammer (?:something|a nail|away)|(?:fix|repair) (?:something|it|things)|be a builder|do some (?:building|construction)",
    { wear: "protective helmet", hold: "toy hammer", moves: ["chop", "chop"], fx: "star", sound: "knock", lines: ["Tap tap tap!", "All fixed!"], end: "proud" }),

  // ---------------------------------------------------------------- cooking & food
  A("cook", "food", "cook something", "cooking soup in your pot", "cook(?:ing)?(?: (?:something|dinner|lunch|breakfast|for (?:me|us)|us|me))?|make (?:me |us )?(?:some )?(?:soup|dinner|lunch|breakfast|a meal|food)|be a chef|play chef",
    { wear: "chef hat", set: "cooking pot", hold: "wooden spoon", moves: ["stir", "stir", "eat"], fx: "huff", sound: "sizzle", lines: ["Stir, stir, stir…", "Mmm! Soup's ready!"], end: "love" }),
  A("bake", "food", "bake a cake", "baking a cake", "bake (?:me |us )?(?:a |some )?(?:cakes?|cookies|cupcakes?|bread|muffins?|pie|something|treats?)?|baking|make (?:me |us )?(?:a |some )?(?:cake|cookies|cupcakes|pie)",
    { wear: "chef hat", hold: "wooden spoon", steps: [["move", "stir"], ["say", "Mix mix mix…"], ["set", "birthday cake"], ["fx", "star", 6], ["sound", "ding"], ["say", "Ding! Fresh from the oven!"], ["move", "present"]], end: "proud" }),
  A("pizza", "food", "make a pizza", "making a pizza", "make (?:me |us )?(?:a )?pizza|pizza party|have (?:a |some )?pizza",
    { wear: "chef hat", steps: [["move", "chop"], ["say", "Cheese… pepperoni…"], ["hold", "pizza slice"], ["fx", "star", 4], ["sound", "ding"], ["move", "eat"]], lines: [null, "Mamma mia!"], end: "love" }),
  A("snack", "food", "have a snack", "having a snack", "(?:have|eat|grab) (?:a |some |your )?(?:snack|cookie|pizza|apple|fruit|ice ?cream|cupcake|popcorn|treat|sweets?|lunch|breakfast|dinner|something)|(?:let'?s |time to )?eat|snack time|lunch ?time",
    { pick: FOOD, hold: "cookie", moves: ["eat", "eat"], fx: "heart", sound: "munch", lines: ["Nom nom nom…", "Yummy!"], end: "love" }),
  A("drink", "food", "have a drink", "having a warm drink", "(?:have|drink|sip|make) (?:a |some |your )?(?:cup of |mug of )?(?:tea|hot cocoa|cocoa|hot chocolate|drink)|(?:tea|cocoa) time",
    { pick: DRINK, hold: "hot cocoa", moves: ["drink", "drink"], fx: "huff", lines: ["Slurrrp…", "Ahh, cozy."], end: "love" }),
  A("teaparty", "food", "have a tea party", "having a tea party with your friends", "(?:have|throw|host) a tea ?party|tea ?party",
    { friends: ["mimi", "cocoa"], role: "hello", hold: "teacup", moves: ["toast", "drink"], fx: "heart", fsay: ["mimi", "More tea, please!"], lines: ["Pinkies up!", "What a lovely party."], end: "love" }),
  A("picnic", "food", "have a picnic", "having a picnic", "(?:have|go on|go for) a picnic|picnic",
    { friends: ["mimi"], role: "hello", set: "picnic basket", hold: "apple", moves: ["eat", "toast"], fx: "heart", fsay: ["mimi", "What a sunny day!"], lines: ["Picnic time!", "This is the best day."], end: "love" }),
  A("movie", "food", "watch a movie", "watching a movie with popcorn", "watch (?:a |some )?(?:movies?|films?|cartoons?|tv)|movie night|(?:have|make) (?:some )?popcorn",
    { hold: "popcorn", moves: ["eat", "look"], fx: "star", sound: "munch", role: "huddle", lines: ["*munch munch*", "Best movie ever!"], end: "surprised" }),

  // ---------------------------------------------------------------- reading & learning
  A("read", "learn", "read a book", "reading a book with your reading glasses on", "read (?:a |the |your |some |me a |me |us a |us )?(?:books?|story|stories|comics?)|reading time|story ?time|tell (?:me |us )?a story",
    { talk: true, wear: "round reading glasses", hold: "book", moves: ["read", "read"], fx: "heart", role: "huddle", lines: ["Once upon a time…", "The end!"], end: "happy" }),
  A("bedtime", "learn", "read a bedtime story", "reading a bedtime story in your nightcap", "(?:read|tell) (?:me |us )?a bedtime story|bedtime story",
    { talk: true, wear: "nightcap", hold: "book", moves: ["read", "read"], fx: "z", sound: "chime", role: "huddle", lines: ["Once upon a time, a sleepy sheep…", "…and they all slept happily ever after."], end: "sleepy" }),
  A("study", "learn", "do homework", "doing homework with your pencil", "(?:do|help with) (?:my |your |some |the )?homework|study(?:ing)?(?= *(?:$|[!.?]|with me|together|time))|do (?:some )?(?:maths?|math|sums|spelling)|practi[cs]e (?:my |your )?(?:writing|spelling|letters)",
    { wear: "round reading glasses", hold: "pencil", moves: ["write", "think", "count"], fx: "star", lines: ["Hmm… carry the one…", "Done! Gold star for me!"], end: "proud" }),
  A("detective", "learn", "be a detective", "looking for clues with your magnifying glass", "be a detective|look for clues|investigate (?:a |the )?(?:mystery|case|crime|clues?)|solve (?:a |the )?mystery|sherlock|search for clues",
    { hold: "magnifying glass", moves: ["look", "sneak", "think"], fx: "star", sound: "hmm", lines: ["Hmm… a clue!", "Case closed!"], end: "proud" }),
  A("stars", "learn", "look at the stars", "stargazing with your telescope", "(?:look at|watch|see|count) (?:the )?stars|stargaz(?:e|ing)|look (?:through|in) (?:a|the|your) telescope|look at the (?:moon|planets|sky)",
    { hold: "telescope", moves: ["look", "look"], fx: "star", sound: "chime", role: "huddle", lines: ["Ooh… a shooting star!", "Make a wish!"], end: "love" }),
  A("globe", "learn", "spin the globe", "spinning your globe", "(?:learn|teach me) about (?:the world|countries|geography)|geography|travel the world|(?:pick|find) (?:a|somewhere) (?:place )?(?:to go )?on the globe",
    { hold: "desk globe", moves: ["present", "think"], fx: "star", lines: ["Spin… and stop!", "Let's go there someday!"], end: "excited" }),
  A("treasure", "learn", "go on a treasure hunt", "on a treasure hunt with your map", "(?:go on |have )?a treasure hunt|treasure hunt|find (?:the |some )?treasure|dig for treasure|be a pirate|pirates?",
    { wear: "backpack", hold: "folded map", steps: [["move", "look"], ["say", "X marks the spot!"], ["move", "dig"], ["fx", "coin", 8], ["sound", "coins"], ["say", "TREASURE!"]], end: "superexcited" }),
  A("measure", "learn", "measure something", "measuring with your ruler", "measure (?:something|it|me|you|things)|how (?:tall|big|long) (?:are you|is it)",
    { hold: "wooden ruler", moves: ["count", "look"], lines: ["One… two… three…", "Exactly fluffy-sized!"], end: "proud" }),
  A("count", "learn", "count to ten", "counting on your hooves", "count (?:to|up to) (?:ten|10|twenty|20|five|5|a hundred|100)|count (?:with me|for me|out loud)|counting",
    { moves: ["count", "count"], fx: "star", lines: ["One, two, three…", "…ten! Yay!"], end: "proud" }),

  // ---------------------------------------------------------------- outdoors & nature
  A("kite", "nature", "fly a kite", "flying your kite", "fly (?:a |the |your )?kite|kite flying|go fly a kite",
    { hold: "kite", moves: ["kite", "kite"], fx: "star", sound: "whoosh", role: "cheer", lines: ["Higher! Higher!", "Wheee!"], end: "excited" }),
  A("balloon", "nature", "play with a balloon", "playing with your red balloon", "play with (?:a |the |your )?balloon|hold (?:a |the |your )?balloon",
    { hold: "red balloon", moves: ["kite", "hop"], fx: "heart", lines: ["Bloop!", "Don't fly away!"], end: "happy" }),
  A("bubbles", "nature", "blow bubbles", "blowing bubbles", "blow (?:some )?bubbles|bubbles",
    { hold: "bubble blaster", steps: [["use"], ["wait", 1200], ["use"], ["fx", "heart", 3]], role: "giggle", lines: ["Bubbles!", "Pop pop pop!"], end: "laugh" }),
  A("garden", "nature", "plant a flower", "gardening", "plant (?:a |some )?(?:flowers?|seeds?|trees?|sunflowers?)|(?:do some )?gardening|garden(?:ing)?|grow (?:a |some )?(?:flowers?|plants?)",
    { hold: "little trowel", steps: [["move", "dig"], ["set", "potted sunflower"], ["fx", "heart", 3], ["hold", "watering can"], ["move", "water"], ["fx", "snow", 6]], lines: ["Dig, dig…", "Grow, little flower!"], end: "love" }),
  A("water", "nature", "water the plants", "watering a sunflower", "water (?:the |your |my |some )?(?:plants?|flowers?|garden|sunflower)",
    { set: "potted sunflower", hold: "watering can", moves: ["water", "water"], fx: "snow", sound: "splash", lines: ["Drink up, little flower!", "Look, it's happy!"], end: "love" }),
  A("butterflies", "nature", "catch butterflies", "chasing butterflies with your net", "(?:catch|chase) (?:some )?(?:butterflies|bugs|fireflies)|butterfly net|go bug hunting",
    { hold: "butterfly net", moves: ["swing", "hop", "swing"], fx: "heart", lines: ["Come here, little butterfly!", "Missed! …that's okay, fly free!"], end: "laugh" }),
  A("fishing", "nature", "go fishing", "fishing", "(?:go |let'?s go )?fishing|catch (?:a |some )?fish|cast (?:a|your) line",
    { hold: "fishing rod", moves: ["fish", "fish"], fx: "snow", sound: "splash", lines: ["Shhh… I think I've got one…", "A tiny one! Bye, little fishy!"], end: "excited" }),
  A("camping", "nature", "go camping", "camping by the campfire", "(?:go |let'?s go )?camping|(?:make|light|build|sit by) (?:a )?campfire|roast (?:some )?marshmallows|campfire",
    { set: "campfire", hold: "flashlight", moves: ["look", "meditate"], fx: "huff", sound: "crackle", friends: ["mimi", "cocoa"], role: "huddle", fsay: ["cocoa", "Tell a spooky story!"], lines: ["So cozy…", "Look at all the stars."], end: "love" }),
  A("tent", "nature", "pitch a tent", "setting up a little tent", "(?:pitch|put up|set up|build) (?:a |the |your )?(?:little )?tent|go in (?:a|the|your) tent",
    { set: "little tent", moves: ["pat", "present"], fx: "star", lines: ["Up it goes!", "Home sweet tent!"], end: "proud" }),
  A("rain", "nature", "play in the rain", "splashing in the rain with your umbrella", "(?:play|dance|splash) in the rain|jump in (?:the )?puddles|splash in (?:the )?puddles|singing in the rain",
    { hold: "little blue umbrella", moves: ["hop", "hula", "hop"], fx: "snow", sound: "splash", lines: ["Splish! Splash!", "I love rainy days!"], end: "excited" }),
  A("snow", "nature", "play in the snow", "playing in the snow", "play in the snow|make (?:a )?snow angels?|it'?s snowing|let it snow|snow day",
    { hold: "snowball", moves: ["shiver", "throw", "hop"], fx: "snow", role: "play", lines: ["Brrr! Snow!", "Snowball!"], end: "laugh" }),
  A("hike", "nature", "go hiking", "hiking with your backpack and map", "(?:go |let'?s go )?(?:hiking|on a hike|on an adventure|exploring|for a hike)|explore (?:outside|around|the (?:garden|woods|forest|meadow|park|outdoors|beach|world))|(?:have|go on) an adventure",
    { wear: "backpack", hold: "folded map", moves: ["march", "look", "march"], fx: "star", role: "play", lines: ["Adventure time!", "What a view!"], end: "excited", stand: true }),
  A("beach", "nature", "go to the beach", "at the beach in your sun hat", "(?:go to|day at|let'?s go to) the beach|beach day|sunbathe|soak up the sun",
    { wear: "hat", set: "sandcastle", moves: ["stretch", "meditate"], fx: "star", sound: "splash", lines: ["Ahh, sunshine!", "Best beach day!"], end: "love" }),

  // ---------------------------------------------------------------- pretend & jobs
  A("doctor", "pretend", "play doctor", "playing doctor with your stethoscope", "play doctors?|be (?:a|my) doctor|be a nurse|check (?:my|your|cocoa'?s|mimi'?s) heart(?:beat)?|(?:give me|do) a check-?up|play vet",
    { wear: "stethoscope", moves: ["look", "think", "count"], fx: "heart", sound: "heartbeat", friends: ["cocoa"], role: "hello", fsay: ["cocoa", "Ahhh!"], lines: ["Say ahh!", "Healthy as a sheep!"], end: "proud" }),
  A("firefighter", "pretend", "be a firefighter", "playing firefighter", "be a fire ?fighter|fire ?fighter|fireman|put out (?:a|the) fire",
    { wear: "firefighter helmet", hold: "water pistol", steps: [["say", "Nee-naw! Nee-naw!"], ["use"], ["wait", 900], ["use"], ["fx", "snow", 6], ["move", "salute"]], lines: [null, "Fire's out!"], end: "proud" }),
  A("astronaut", "pretend", "be an astronaut", "blasting off to space", "be an astronaut|astronaut|go to (?:space|the moon|mars)|blast off|rocket ship ride|fly to the moon",
    { wear: "space helmet", steps: [["say", "3… 2… 1…"], ["sound", "whoosh"], ["move", "fly"], ["fx", "star", 8], ["say", "BLAST OFF!"], ["move", "fly"]], lines: [null, "One small hop for a sheep!"], end: "superexcited" }),
  // more jobs to dress up as (Nov 7, shared/jobs.js): one thing that says the job, and its tool
  A("police", "pretend", "be a police officer", "being a police officer in your police cap, walkie-talkie in hoof", "be (?:a|an|the|our) (?:police ?(?:officer|man|woman)?|cop|policeman|policewoman|sheriff)|play (?:cops|police)|police (?:officer|patrol)|officer mochi",
    { wear: "police cap", hold: "walkie-talkie", steps: [["move", "salute"], ["say", "Officer Mochi, on patrol!"], ["move", "phone"], ["say", "Copy that! All quiet in the meadow."], ["move", "look"]], lines: [null, "All clear!"], end: "proud", stand: true }),
  A("engineer", "pretend", "be an engineer", "being an engineer in your hard hat, wrench in hoof", "be (?:a|an|the|our) (?:engineer|builder|construction worker|mechanic|plumber|handyman|electrician)|fix (?:it|something|things) (?:up )?with (?:a|your) wrench|build (?:a|something) like an engineer",
    { wear: "hard hat", hold: "wrench", moves: ["stir", "look", "stir"], fx: "star", sound: "knock", lines: ["Safety first! Hard hat on!", "Fixed it! Good as new!"], end: "proud" }),
  A("pilot", "pretend", "be a pilot", "being an airline pilot in your pilot cap", "be (?:a|an|the|our) (?:airline |airplane )?pilot|captain mochi|fly (?:a|the|an) (?:plane|airplane|jet) like a pilot",
    { wear: "pilot cap", moves: ["salute", "fly"], fx: "star", sound: "whoosh", lines: ["This is your captain speaking!", "Smooth landing, everyone!"], end: "proud", stand: true }),
  A("farmer", "pretend", "be a farmer", "being a farmer in your straw hat, watering the crops", "be (?:a|an|the|our) (?:farmer|gardener|rancher|cowboy|cowgirl)|play (?:farm|farmer)|work on (?:a|the) farm",
    { wear: "straw hat", hold: "watering can", set: "potted sunflower", moves: ["water", "wave"], fx: "heart", lines: ["Howdy! Time to water the crops!", "Look how they grow!"], end: "happy" }),
  A("artist", "pretend", "be an artist", "being an artist in your beret, paintbrush in hoof", "be (?:a|an|the|our) (?:artist|painter)|artiste|ooh la la",
    { wear: "beret", hold: "paintbrush", moves: ["conduct", "present"], fx: "star", lines: ["Ooh la la, a masterpiece!", "Voilà!"], end: "proud" }),
  A("detective", "pretend", "be a detective", "being a detective in your deerstalker hat, magnifying glass in hoof", "be (?:a|an|the|our) (?:detective|investigator|private eye|sleuth)|play (?:detective|detectives)|solve (?:a|the) (?:mystery|case|crime)|sherlock",
    { wear: "detective hat", hold: "magnifying glass", moves: ["sneak", "look", "think"], sound: "hmm", lines: ["Hmm… a clue!", "Mystery solved!"], end: "proud" }),
  A("superhero", "pretend", "be a superhero", "being a superhero in your cape", "be a superhero|superhero|super ?mochi|save the day|fly like a superhero",
    { wear: "cape", moves: ["present", "fly", "salute"], fx: "star", sound: "whoosh", role: "cheer", lines: ["Super Mochi to the rescue!", "Day saved!"], end: "showoff", stand: true }),
  A("wizard", "pretend", "be a wizard", "casting spells in your wizard hat", "be a wizard|wizard|cast a spell|do a spell|magic spell|be a witch",
    { wear: "wizard hat", hold: "star wand", moves: ["conduct", "present"], fx: "orbit", sound: "chime", lines: ["Fluffius maximus!", "It worked! …I think."], end: "proud" }),
  A("king", "pretend", "be a king", "being king of the meadow in your crown", "be (?:a|the) (?:king|prince|queen|princess|royal)|royalty|your majesty",
    { wear: "golden crown", moves: ["present", "bow"], fx: "star", sound: "trumpetFanfare", role: "cheer", lines: ["Hear ye, hear ye!", "Cookies for everyone!"], end: "proud", stand: true }),
  A("knight", "pretend", "be a knight", "being a brave knight", "be a knight|knight|slay (?:a|the) dragon|brave knight",
    { wear: "protective helmet", hold: "foam sword", moves: ["salute", "swing", "present"], fx: "star", sound: "whoosh", lines: ["For the meadow!", "The dragon ran away!"], end: "proud", stand: true }),
  A("chef", "pretend", "be a chef", "being a chef", "be (?:a|the) (?:chef|cook|baker)|chef mochi|run a restaurant|play restaurant|play kitchen",
    { wear: "chef hat", hold: "wooden spoon", set: "cooking pot", moves: ["stir", "toast"], fx: "huff", sound: "sizzle", lines: ["Welcome to Chez Mochi!", "Bon appétit!"], end: "proud" }),
  A("teacher", "pretend", "play school", "playing teacher for Mimi and Cocoa", "play (?:school|teacher)|be (?:a|my|the) teacher|teach (?:me|us) something|give (?:me|us) a lesson",
    { wear: "round reading glasses", hold: "book", friends: ["mimi", "cocoa"], role: "hello", moves: ["present", "count"], fsay: ["cocoa", "Ooh, ooh, I know!"], lines: ["Good morning, class!", "Gold stars all round!"], end: "proud" }),
  A("scientist", "pretend", "be a scientist", "doing science", "be a scientist|(?:do|try) (?:an |a |some )?(?:science|experiment)|science (?:time|experiment)",
    { wear: "round reading glasses", hold: "magnifying glass", moves: ["look", "think", "cheer"], fx: "star", sound: "bleeps", lines: ["Hypothesis: fluffy.", "Science!"], end: "excited" }),
  A("reporter", "pretend", "be a news reporter", "reporting the news", "be a (?:news )?reporter|read the news|do the (?:news|weather)(?: report)?(?= *(?:$|[!.?]))|be a weather ?(?:man|sheep|reporter)",
    { talk: true, hold: "microphone", moves: ["phone", "present"], lines: ["This just in…", "Back to you in the studio!"], end: "proud" }),
  // judges (Nov 7, Binoy: "Can mochi also act like a judge - both a casual hackathon judge and a civil court judge (and
  // also have the corresponding attires for them)?"). The hackathon one first: "be a judge at our hackathon" is that one
  A("hackjudge", "pretend", "be a hackathon judge", "judging a hackathon in your comfy hoodie and judge badge, clipboard in hoof",
    "(?:be|act like|pretend to be|play) (?:a|the|our) (?:casual )?hackathon judge|hackathon judge|judge (?:my|our|this|the) (?:project|hack|app|demo|pitch|idea|startup|presentation|submission)|(?:score|rate|grade) (?:my|our|this|the) (?:project|hack|app|demo|pitch|startup|presentation|submission)|judge (?:a|the|our) hackathon|be (?:a|the|our) judge (?:at|for) (?:a|the|our|my) hack(?:athon)?",
    { talk: true, brief: "If they told you about their project, score it out of 10 for idea, build and demo, say one thing you loved and give one friendly tip; if they didn't, ask what they built.", wear: "hackathon hoodie", hold: "clipboard", friends: ["mimi"], role: "hello", steps: [["move", "look"], ["move", "write"], ["fsay", "mimi", "And here's our demo, judges!"], ["move", "think"], ["move", "write"]], lines: ["Ooh, what did you build?", "Ten out of ten for fluffiness!"], end: "proud" }),
  A("courtjudge", "pretend", "be a judge", "being a judge in your black robe, gavel in hoof, with Mimi and Cocoa in court",
    "be (?:a|the|our|my) (?:court |courtroom |civil court |trial )?judge|act like a judge|pretend (?:to be )?(?:a )?judge|play (?:court|courtroom|trial|judge)|judge (?:this|our|my|a) (?:case|argument|fight|dispute)|order in the court|your honou?r|hold court|courtroom|court ?case|(?:settle|decide|rule on) (?:this|our|my|a) (?:case|argument|dispute|fight)|civil court",
    { talk: true, brief: "If they told you about a case, hear both sides and give a fair, kind and funny verdict; if they didn't, it's the case of the missing cookie, and Cocoa has crumbs on his bandana.", wear: "judge's robe", hold: "gavel", set: "sound block", friends: ["mimi", "cocoa"], role: "ready", stand: true, steps: [["move", "present"], ["fsay", "cocoa", "All rise for the Honorable Judge Mochi!"], ["move", "swing"], ["sound", "knock", 1200], ["move", "think"], ["fsay", "mimi", "Your Honor, may I speak?"], ["move", "swing"], ["sound", "knock", 1200]], lines: ["Order in the court!", "Case closed!"], end: "proud" }),
  A("rockstar", "pretend", "be a rock star", "being a rock star", "be a rock ?star|rock ?star|rock out|play (?:some )?rock (?:and|n) roll",
    { wear: "round reading glasses", hold: "guitar", moves: ["strum", "hop", "strum"], fx: "note", sound: "guitar", role: "cheer", lines: ["Hello, Meadow!", "Thank you, good night!"], end: "showoff" }),
  A("comedy", "pretend", "tell a joke", "telling a joke", "tell (?:me |us )?(?:a |some |another )?jokes?|be funny|make (?:me|us) laugh|comedy (?:show|time)",
    { talk: true, moves: ["present"], steps: [["move", "present"], ["wait", 2200], ["sound", "rimshot"], ["face", "laugh", 1800], ["fx", "star", 3]], role: "giggle", end: "laugh" }),

  // ---------------------------------------------------------------- chores & taking care
  A("teeth", "care", "brush your teeth", "brushing your teeth", "brush (?:your|my|his|the) teeth|teeth brushing|brush brush",
    { hold: "toothbrush", moves: ["brush", "brush"], fx: "snow", sound: "brush", lines: ["Scrub scrub scrub…", "Sparkly clean! Ting!"], end: "proud" }),
  A("bath", "care", "take a bath", "having a bubble bath", "(?:take|have) a (?:bubble )?bath|bath ?time|bubble bath|get clean|wash yourself|get washed",
    { set: "rubber duck", moves: ["swim", "shake"], fx: "snow", sound: "splash", lines: ["Rubber ducky, you're the one!", "All clean and fluffy!"], end: "happy" }),
  A("clean", "care", "clean up", "dusting with your feather duster", "clean (?:up(?! (?:my|this|that|the|our|these|those|his|her|their)\\b)|your room|the house|the stage|everything)|tidy (?:up(?! (?:my|this|that|the|our|these|those)\\b)|your room)|do (?:some |the )?(?:chores|cleaning|dusting|housework)|dust(?:ing)?|sweep(?:ing)?",
    { hold: "feather duster", moves: ["sweep", "sweep"], fx: "huff", sound: "brush", lines: ["Dust, be gone!", "Squeaky clean!"], end: "proud" }),
  A("nap", "care", "take a little nap", "taking a cat nap sitting up", "(?:take|have) a (?:little |quick |short |cat )?nap|(?:a )?power nap|rest your eyes|have a rest",
    { wear: "nightcap", moves: ["meditate"], steps: [["move", "meditate"], ["face", "sleepy", 3000], ["fx", "z", 3], ["wait", 2600]], lines: [null, "*yawn* That was a good one."], end: "happy" }),

  // ---------------------------------------------------------------- celebrations
  A("birthday", "party", "have a birthday party", "having a birthday party", "(?:have|throw) a birthday party|birthday party|it'?s (?:my|your|mimi'?s|cocoa'?s) birthday|happy birthday|celebrate (?:a |my |your )?birthday|blow out (?:the )?candles",
    { friends: ["mimi", "cocoa"], role: "cheer", wear: "party hat", set: "birthday cake", steps: [["say", "Make a wish!"], ["move", "blow"], ["fx", "confetti", 8], ["sound", "party"], ["move", "cheer"]], fsay: ["mimi", "Hip hip hooray!"], end: "superexcited" }),
  A("present", "party", "open a present", "opening a present", "(?:open|unwrap) (?:a |the |your |my )?(?:present|gift)|give (?:me|you|him|her|mimi|cocoa) a (?:present|gift)|presents? time",
    { set: "present", steps: [["move", "pat"], ["say", "What could it be…?"], ["fx", "confetti", 8], ["sound", "pop"], ["face", "superexcited", 1600]], lines: [null, "I love it!"], end: "love" }),
  A("award", "party", "have an award ceremony", "getting a gold medal", "(?:have|hold) an? (?:award|medal) ceremony|give (?:yourself|me|you) (?:a |an )?(?:medal|award|trophy)|win (?:a |the )?(?:medal|trophy|gold)|(?:be|you'?re) (?:the )?champion",
    { wear: "gold medal", hold: "trophy", moves: ["present", "bow"], fx: "confetti", sound: "trumpetFanfare", role: "cheer", lines: ["I'd like to thank my fluff…", "Champion sheep!"], end: "proud" }),
  A("fireworks", "party", "set off fireworks", "setting off fireworks", "(?:set off|light|watch|do|make|shoot) (?:some )?fireworks|fireworks",
    { hold: "big confetti rocket launcher", steps: [["wait", 2200], ["use"], ["wait", 2400]], role: "cheer", lines: ["3… 2… 1…", "Ooooh! Aaaah!"], end: "superexcited" }),
  A("toast", "party", "make a toast", "raising a toast", "make a toast|raise (?:a|your) (?:glass|cup)|cheers to|a toast to",
    { hold: "teacup", moves: ["toast"], fx: "heart", lines: ["To friends!", "Cheers!"], end: "love" }),

  // ---------------------------------------------------------------- gadgets
  A("walkie", "tech", "use the walkie-talkie", "talking to Cocoa on your walkie-talkie", "(?:use|talk on|play with) (?:the |your |a )?walkie-?talkies?|walkie-?talkies?|over and out",
    { hold: "walkie-talkie", moves: ["phone"], friends: ["cocoa"], role: "hello", fsay: ["cocoa", "Loud and clear! Over!"], lines: ["Come in, Cocoa! Over!", "Over and out!"], end: "laugh" }),
  A("phone", "tech", "talk on the phone", "chatting on your phone", "talk on (?:the|your) phone|make a (?:phone )?call|phone (?:a friend|someone|grandma|home)|text (?:someone|a friend)",
    { hold: "magenta smartphone", moves: ["phone", "phone"], lines: ["Hello? Hi! It's Mochi!", "Okay, bye bye!"], end: "happy" }),
  A("flashlight", "tech", "play with the flashlight", "making shadow puppets with your flashlight", "(?:make|do) (?:some )?shadow puppets|play with (?:the|your|a) flashlight|shine (?:the|your|a) flashlight",
    { hold: "flashlight", moves: ["look", "present"], fx: "star", lines: ["Look, a bunny shadow!", "Spooky!"], end: "laugh" }),

  // ---------------------------------------------------------------- anything at all
  A("anything", "party", "do something fun", "doing something fun", "do something (?:fun|cool|silly|new|else)|surprise me|show me something (?:fun|cool|new)|(?:do|try) an activity",
    { pickOne: "*" }),
];
export const BOOK_BY_ID = Object.fromEntries(BOOK.map((e) => [e.id, e]));

/** for the brain and the workshop page: what's in the book, by category */
export function bookSummary() {
  return CATEGORIES.map(([c, label]) => `${label.toLowerCase()} (${BOOK.filter((e) => e.cat === c && !e.pickOne).map((e) => e.name).slice(0, 7).join(", ")})`).join("; ");
}
