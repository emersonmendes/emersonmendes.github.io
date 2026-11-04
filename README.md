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
