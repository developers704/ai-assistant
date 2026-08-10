import { suggestComposeContinuation } from "../src/lib/valliani-mail/smart-compose";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  suggestComposeContinuation("hi how are") === " you?",
  'expected " you?" after hi how are'
);
assert(
  suggestComposeContinuation("hi how are ") === "you?",
  'expected "you?" when trailing space'
);
assert(
  suggestComposeContinuation("Thanks — looking forward") ===
    " to hearing from you",
  "looking forward phrase"
);
assert(
  suggestComposeContinuation("I am lookin") === "g forward to",
  "partial word lookin"
);
assert(suggestComposeContinuation("") === "", "empty");
assert(suggestComposeContinuation("xyzzy") === "", "no match");

console.log("check-smart-compose: ok");
