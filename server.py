import json
import time
import urllib.request
import urllib.error
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite que o seu HTML acesse esta API

PLATFORMAS = {
    "YouTube": "https://www.youtube.com/@{user}",
    "GitHub": "https://api.github.com/users/{user}",
    "Reddit": "https://www.reddit.com/user/{user}",
    "Twitter (X)": "https://x.com/{user}",
    "Pinterest": "https://www.pinterest.com/{user}/",
    "TikTok": "https://www.tiktok.com/@{user}",
    "Blogger": "https://{user}.blogspot.com",
    "WordPress": "https://{user}.wordpress.com",
    "Tumblr": "https://{user}.tumblr.com",
    "Flickr": "https://www.flickr.com/people/{user}/"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def checar_registro_br(dominio):
    url = f"https://registro.br/v2/ajax/avail/raw/{dominio}.com.br"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            dados = json.loads(response.read().decode('utf-8'))
            status = dados.get("status")
            if status == 0:
                return "available"  # Livre
            elif status == 1:
                return "taken"      # Ocupado
            return "special"       # Processo especial
    except Exception:
        return "error"

def checar_rede(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.getcode() == 200:
                return "taken"
            return "unknown"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "available"
        return "taken"
    except Exception:
        return "error"

@app.route('/verificar', methods=['GET'])
def verificar():
    nome = request.args.get('nome', '').strip()
    if not nome:
        return jsonify({"erro": "Nome não fornecido"}), 400

    print(f"🔎 Recebida consulta da web para: {nome.upper()}")
    
    resultados = {}
    
    # Checa o .com.br
    resultados["Domínio .com.br"] = checar_registro_br(nome)

    # Checa cada plataforma
    for rede, url_template in PLATFORMAS.items():
        url = url_template.format(user=nome)
        resultados[rede] = checar_rede(url)
        time.sleep(0.15)  # Pequeno delay anti-bloqueio

    return jsonify({
        "nome": nome,
        "resultados": resultados
    })

if __name__ == '__main__':
    print("🚀 Servidor local rodando em: http://127.0.0.1:5000")
    app.run(port=5000, debug=True)