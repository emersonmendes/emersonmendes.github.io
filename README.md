# emersonmendes.github.io

[https://emersonmendes.github.io/](https://emersonmendes.github.io/)

## Rodando localmente

O site é estático (sem build), mas precisa ser servido por HTTP, pois o `emerson.txt` é carregado via requisição — abrir o `index.html` direto pelo navegador (`file://`) não funciona.

Na raiz do projeto, rode:

```sh
python3 -m http.server 8000
```

E acesse [http://localhost:8000](http://localhost:8000).

Para parar o servidor, use `Ctrl+C`.

## Testes

Os testes rodam o site de verdade num Chrome headless (precisa de `python3` e Chrome/Chromium):

```sh
tests/run.sh          # todos os testes
tests/run.sh "Tab"    # só os testes cujo nome contém "Tab"
```

Também dá para ver no navegador: com o servidor local rodando, acesse [http://localhost:8000/tests/](http://localhost:8000/tests/).

Toda feature nova ou correção de bug deve vir acompanhada de testes em `tests/tests.js`.
