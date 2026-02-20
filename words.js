// words.js - Large Word Bank for Skribbl Replica
const wordBank = [
    // --- Animals ---
    "dog", "cat", "elephant", "giraffe", "lion", "tiger", "zebra", "monkey", "penguin", 
    "shark", "whale", "octopus", "butterfly", "spider", "snake", "rabbit", "hamster", 
    "chicken", "horse", "dolphin", "kangaroo", "panda", "crocodile", "dinosaur",

    // --- Food & Drink ---
    "pizza", "burger", "taco", "sushi", "apple", "banana", "donut", "ice cream", 
    "hotdog", "sandwich", "spaghetti", "pancake", "strawberry", "pineapple", "cookie",
    "cake", "broccoli", "carrot", "egg", "milk", "coffee", "juice", "watermelon",

    // --- Objects & Tools ---
    "laptop", "smartphone", "camera", "guitar", "piano", "hammer", "scissors", "pencil",
    "umbrella", "toothbrush", "glasses", "flashlight", "backpack", "clock", "television",
    "telescope", "microscope", "calculator", "keyboard", "bottle", "key", "wallet",

    // --- Vehicles & Travel ---
    "airplane", "bicycle", "car", "bus", "train", "helicopter", "boat", "rocket", 
    "spaceship", "submarine", "skateboard", "motorcycle", "tractor", "parachute",

    // --- Buildings & Nature ---
    "house", "castle", "pyramid", "lighthouse", "hospital", "school", "bridge", 
    "mountain", "volcano", "ocean", "river", "forest", "desert", "island", "cave", 
    "waterfall", "rainbow", "cloud", "sun", "moon", "star", "flower", "tree",

    // --- Activities & Sports ---
    "football", "basketball", "tennis", "soccer", "fishing", "dancing", "cooking", 
    "running", "swimming", "boxing", "skating", "painting", "singing", "sleeping",

    // --- Hard/Abstract Words ---
    "electricity", "gravity", "internet", "shadow", "silence", "echo", "nightmare", 
    "whisper", "balance", "rhythm", "victory", "danger", "mystery", "pollution",
    "reflection", "energy", "symmetry", "parallel", "velocity", "atmosphere",

    // --- Skribbl Classics ---
    "batman", "spongebob", "pikachu", "mario", "shrek", "minecraft", "superman",
    "mickey mouse", "statue of liberty", "eiffel tower", "great wall of china"
];

// Optional: Function to get 3 random words for the "Pick a Word" feature
function getRandomWords(count = 3) {
    const shuffled = [...wordBank].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
