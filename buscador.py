import unicodedata
import re

def sanitizar_nome(texto):
    # 1. Converte para minúsculas
    texto = texto.lower().strip()
    
    # 2. Remove acentos (ex: Núcleo -> Nucleo)
    texto = unicodedata.normalize('NFKD', texto)
    texto = "".join([c for c in texto if not unicodedata.combining(c)])
    
    # 3. Remove espaços e caracteres especiais (ex: Lar em Teste -> laremteste)
    texto = re.sub(r'[^a-z0-9]', '', texto)
    
    return texto

import time
import json
import urllib.request
import urllib.error

PLATAFORMAS = {
    "Threads": "https://www.threads.net/@{user}",
    "YouTube": "https://www.youtube.com/@{user}",
    "Twitch": "https://www.twitch.tv/{user}",
    "Bluesky": "https://bsky.app/profile/{user}.bsky.social",
    "Telegram": "https://t.me/{user}",
    "GitHub": "https://api.github.com/users/{user}",
    "Reddit": "https://www.reddit.com/user/{user}",
    "TikTok": "https://www.tiktok.com/@{user}",
    "Pinterest": "https://www.pinterest.com/{user}/",
    "Medium": "https://medium.com/@{user}",
    "Dev.to": "https://dev.to/{user}",
    "Blogger": "https://{user}.blogspot.com",
    "WordPress": "https://{user}.wordpress.com",
    "Tumblr": "https://{user}.tumblr.com"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def checar_registro_br(dominio_sem_extensao):
    url = f"https://registro.br/v2/ajax/avail/raw/{dominio_sem_extensao}.com.br"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            dados = json.loads(response.read().decode('utf-8'))
            status = dados.get("status")
            if status == 0:
                return "available"  # Livre
            elif status == 1:
                return "taken"      # Registrado
            return "special"       # Processo de liberação
    except Exception:
        return "error"

def checar_rede(url, rede):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.getcode()
            if status == 200:
                return "taken"
            return "unknown"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "available"
        elif e.code in [301, 302]:
            return "redirect"
        return f"status_{e.code}"
    except Exception:
        return "error"

def processar_lista(lista_nomes):
    relatorio = []
    total_nomes = len(lista_nomes)

    print(f"\n🚀 Iniciando análise de {total_nomes} nome(s)...")

    for i, nome in enumerate(lista_nomes, 1):
        print(f"\n[{i}/{total_nomes}] 🔎 Analisando: {nome.upper()}")
        print("-" * 50)

        item = {
            "nome": nome,
            "registro_br": checar_registro_br(nome),
            "site_url_br": f"https://{nome}.com.br",
            "site_url_com": f"https://{nome}.com",
            "redes": {}
        }

        status_br = "🟢 LIVRE" if item["registro_br"] == "available" else "🔴 OCUPADO"
        print(f"  Domínio .com.br: {status_br}")

        for rede, url_template in PLATAFORMAS.items():
            url = url_template.format(user=nome)
            status = checar_rede(url, rede)
            
            # Se for a API do GitHub, gera a URL amigável para navegação no HTML
            display_url = f"https://github.com/{nome}" if rede == "GitHub" else url
            
            item["redes"][rede] = {
                "status": status,
                "url": display_url
            }

            icone = "✅" if status == "available" else ("❌" if status == "taken" else "⚠️")
            print(f"  {icone} [{rede}]: {status}")
            time.sleep(0.18)

        relatorio.append(item)

    with open("resultados.json", "w", encoding="utf-8") as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 50)
    print("✨ Concluído! Relatório atualizado em: resultados.json")
    print("=" * 50 + "\n")

def main():
    print("==============================================")
    print("  BUSCADOR EXPANDIDO (DOMÍNIO + 14 REDES)     ")
    print("==============================================")
    print("Separe vários nomes por vírgula.")
    print("Exemplo: voxelhub, glitchquest, colabpixel\n")

    while True:
        entrada = input("Digite os nomes (ou 'sair'): ").strip()
        if not entrada:
            continue
        if entrada.lower() == "sair":
            break

        nomes = [n.strip().replace("@", "") for n in entrada.split(",") if n.strip()]
        if nomes:
            processar_lista(nomes)

if __name__ == "__main__":
    main()