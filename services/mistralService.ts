
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const mistralRequest = async (prompt: string, model: string, system?: string, userKey?: string): Promise<string> => {
  const apiKey = userKey || process.env.MISTRAL_API_KEY || process.env.API_KEY; 
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) throw new Error(`Mistral API error: ${response.statusText}`);
  const data = await response.json();
  return data.choices[0].message.content;
};
