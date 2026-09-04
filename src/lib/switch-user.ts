export async function switchDemoUser(userId: string): Promise<void> {
  const response = await fetch("/api/dev/switch-user", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw new Error(`Switch user failed with status ${response.status}`);
  }
}
