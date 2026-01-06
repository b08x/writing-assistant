
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const grokRequest = async (prompt: string, model: string, system?: string, userKey?: string): Promise<string> => {
  const apiKey = userKey || process.env.GROK_API_KEY || process.env.API_KEY;
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
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

  if (!response.ok) throw new Error(`Grok API error: ${response.statusText}`);
  const data = await response.json();
  return data.choices[0].message.content;
};
