// Test-only identity adapter. Production continues to use ChatGPT authentication.
let user:string|null=null;
export function setUser(value:string|null){user=value}
export async function getChatGPTUser(){return user?{userId:user}:null}
