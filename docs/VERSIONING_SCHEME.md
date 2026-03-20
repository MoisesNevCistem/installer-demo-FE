# **Esquema de Versionamiento**

En esta sección, se describirá la convención para el versionamiento de productos de software, en diferentes facetas del ciclo de vida del desarrollo.

La convención consiste en un *Versionamiento Semántico (SEM Ver),* el cual utiliza números y etiquetas para declarar la estabilidad de un producto.

> **NOTA**: Considere que estas convenciones no son estrictamente de algún estándar oficial, sino que es el resultado de diferentes investigaciones. Usted mismo puede implementar sus propias convenciones en sus proyectos. 
>
>Independientemente de la convención que elijas, lo más importante es mantener consistencia y comunicar claramente los cambios realizados en cada versión.

## **Semántica Numeración**

Consiste en establecer una numeración dividida en tres segmentos y separados por un punto. Cada segmento tiene una interpretación distinta, la cual es la siguiente:

Por ejemplo, supongamos que tenemos la siguiente versión: `v1.5.0`, donde:

- `X`, tiene el valor de `1`.
- `Y`, tiene el valor de `5`.
- `Z`, tiene l valor de `0`.

| Segmento | Concepto |
| -------- | -------- |
| `X` | El segmento `X`, representa la versión mayor o principal del software. Este número cambia cuando se implementan un conjunto de características nuevas. También puede cambiar cuando se implementa una característica nueva que ya no es compatible  con la versión anterior del producto. |
| `Y` | El segmento `Y`, representa la versión menor del software. Este número cambia cuando se integra una característica nueva y este sigue siendo compatible con la versión anterior. También puede cambiar cuando se han llevado a cabo refactorizaciones. |
| `Z` | El segmento `Z`, representa una versión de corrección. Este número cambia cuando se solucionan errores de la aplicación. |

### **Interpretación**

Y, ¿Cómo es el proceso de actualización de cada segmento?

- Si el valor del segmento `X` es actualizado, tanto `Y` como `Z`, se reiniciarán en cero:
    - Ejemplo, si antes teníamos `v1.5.1` y queremos actualizar a la versión 2, el resultado será `v2.0.0`.
- Si el valor del segmento `Y` es actualizado, el valor de `X` sigue conservándose, pero el valor de `Z`, se reiniciará en cero:
    - Ejemplo, si antes teníamos `v1.5.1` y queremos actualizar a la 1.6, el resultado será `v1.6.0`.
- Si el valor del segmento `Z` es actualizado, tanto `X` como `Y`, seguirán conservando su valor:
    - Ejemplo, si antes teníamos `v1.5.1` y queremos actualizar un error más, el resultado será `v1.5.2`.


> *Agregar el prefijo “`v`” antes de cada versión, en general es completamente opcional, pero en este modelo, si es requerido.*

## **Versionado por Estabilidad**

Consiste en distinguir la madurez del proyecto por medio de una etiqueta. Estás etiquetas de estabilidad, son las siguientes:

| Etiqueta | Concepto |
| --- | --- |
| `alpha` | Se aplica cuando el software aún es inestable o esta en una etapa inicial. Hay muchos errores y esta abierto a mejorar. En esta fase, el producto aún no puede ser publicado en producción. |
| `beta` | Se aplica cuando el software es considerado "relativamente estable" a comparación de la versión alpha. Sigue teniendo errores y sigue siendo abierto a mejoras pero además el producto si puede ser probado. Algo a considerar, es que las características que aquí se vean, pueden llegar o no al producto final.En esta fase, el producto aún no puede ser publicado en producción. |
| `rc` | Significa Release Candidate y es una versión mejorada del beta. Se aplica cuando el software esta próximo a liberarse, pero antes de hacerlo, pasa por una revisión para refinar algunos detalles, aunque muy mínimos. En esta fase, el producto podría ser publicado en producción, pero bajo el riesgo del cliente. |
| `stable` | Se aplica cuando el producto es considerado "estable" o listo para liberarse a producción. En esta fase, el producto puede ser publicado en producción. Ya debe ser completamente funcional y apta para todos los usuarios finales. |

## **Versionamiento Final**

Una vez planteados los fundamentos de la semántica numérica y la semántica etiquetada, ahora solo resta decir la conclusión final de este ejercicio:

- Si se encuentra con un versionado `X.Y.Z-alpha`, esto indica que esa versión es inestable y que no es recomendable publicarse en producción.
- Si se encuentra con un versionado `X.Y.Z-beta`, esto indica que esa versión puede usarse, pero únicamente con fines didácticos o de prueba, dado que aún puede mejorarse. Además de que puede que hayan características que sufran cambios en el futuro o bien, dejen de existir.
- Si se encuentra con un versionado `X.Y.Z-rc`, esto indica que esa versión podría publicarse en producción, pero queda a discreción del cliente final, dado que pueden haber detalles a refinar.
- Si se encuentra con un versionado `X.Y.Z-stable`, es indica que esa versión ya puede publicarse en producción, dado que el producto ya debe ser funcional y apto para todos los usuarios finales.

--- 
📌 **[Volver a README](../README.md)**