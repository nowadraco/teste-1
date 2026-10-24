import time
import json
import urllib.request
import urllib.error

PLATAFORMAS = {
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

def checar_registro_br(dominio_sem_extensao):
    url = f"https://registro.br/v2/ajax/avail/raw/{dominio_sem_extensao}.com.br"
    req = urllib.request.Request(url, headers=HEADERS)
    
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            dados = json.loads(response.read().decode('utf-8'))
            status = dados.get("status")
            
            # 0 = Disponível | 1 = Já registrado | 2 = Em processo/reservado
            if status == 0:
                print(f"  🟢 [Domínio .com.br]: DISPONÍVEL PARA REGISTRO!")
            elif status == 1:
                print(f"  🔴 [Domínio .com.br]: Ocupado (Já registrado)")
            else:
                print(f"  🟡 [Domínio .com.br]: Status especial ({status})")
    except Exception:
        print(f"  ⛔ [Domínio .com.br]: Falha ao consultar o Registro.br")

def checar_usuario(nome):
    print(f"\n🔎 Analisando identificador: {nome.upper()}")
    print("-" * 45)
    
    # Checagem específica do domínio nacional
    checar_registro_br(nome)
    
    # Checagem das redes sociais
    for rede, url_template in PLATAFORMAS.items():
        url = url_template.format(user=nome)
        req = urllib.request.Request(url, headers=HEADERS)
        
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                status = response.getcode()
                if status == 200:
                    print(f"  ❌ [{rede}]: Ocupado (200)")
                else:
                    print(f"  ⚠️ [{rede}]: Status {status}")
                    
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  ✅ [{rede}]: Provavelmente DISPONÍVEL (404)")
            elif e.code in [301, 302]:
                print(f"  ⚠️ [{rede}]: Redirecionamento ({e.code})")
            else:
                print(f"  ❓ [{rede}]: Status {e.code}")
        except Exception:
            print(f"  ⛔ [{rede}]: Timeout ou bloqueio de requisição")
        
        time.sleep(0.3)
        
    print("=" * 45)

def main():
    print("==============================================")
    print("  BUSCADOR DE USUÁRIOS E DOMÍNIO .COM.BR     ")
    print("==============================================")
    print("Digite 'sair' para encerrar.\n")
    
    while True:
        entrada = input("Digite o nome que quer testar: ").strip()
        
        if not entrada:
            continue
            
        if entrada.lower() == "sair":
            print("Encerrando o verificador. Até mais!")
            break
            
        checar_usuario(entrada)
        print()

if __name__ == "__main__":
    main()