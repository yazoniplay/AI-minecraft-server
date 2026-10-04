import {test} from "node:test";
import assert from "node:assert/strict";
import {GeminiFlashLiteProvider} from "./gemini.js";

test("Gemini provider defaults to the requested production model",()=>{
 const provider=new GeminiFlashLiteProvider({apiKey:"test"});
 assert.equal(provider.model,"gemini-3.5-flash-lite");
});

test("Gemini provider accepts an explicit model override",()=>{
 const provider=new GeminiFlashLiteProvider({apiKey:"test",model:"gemini-3.5-flash-lite"});
 assert.equal(provider.model,"gemini-3.5-flash-lite");
});
