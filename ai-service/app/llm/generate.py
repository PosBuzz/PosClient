from langchain_core.prompts import PromptTemplate
from langchain_community.llms import Ollama

# Instantiate the local Mistral model
llm = Ollama(model="mistral")

prompt = PromptTemplate.from_template(
    "Generate a short, factual product description (max 30 words) for '{product}', suitable for a POS system. The product is commonly available in Bangladesh. Focus on key features and usage."
)


def generate_description(product: str):
    chain = prompt | llm
    return chain.invoke({"product": product})
