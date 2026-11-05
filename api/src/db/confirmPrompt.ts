import { createInterface } from 'node:readline/promises'

// Asks the operator to type an exact confirmation word before a destructive action
export async function confirmByTyping(message: string, confirmationWord: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await prompt.question(`${message} Type ${confirmationWord} to continue: `)
  prompt.close()
  return answer.trim() === confirmationWord
}
