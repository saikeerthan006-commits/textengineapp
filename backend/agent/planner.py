"""Small planning boundary; summaries are user-safe action labels, never model reasoning."""


def plan_request(product: str, user_message: str) -> list[str]:
    del product, user_message
    return ["Analyzing request", "Preparing response"]
