# CRYSTALLIZE GRAPHQL API SCHEMA

## THE DISCOVERY API FOR GETTING 'generiskProduk' HAS CERTAIN AVAILABLE KEYWORDS. THIS SAMPLE QUERY USES THE KEYWORDS WE HAVE CAN USE. WE CAN ONLY USE THESE.

## QUERY
```graphql
  query FIND_PRODUCTS_BROWSE_REGEX($search_term: String!,$paginationToken:String) {
      browse {
          generiskProdukt(
              pagination:{
                limit:2
                after:$paginationToken
              }
              filters: {
                  OR: [
                      
                      { shortcuts_path: {regex: $search_term}},
                      { topics:{regex: $search_term}},
                      { name: {regex: $search_term}},
                      { productInfo_description_body_plainText:{regex:$search_term}}
                  ]
              }
              options: {
              fuzzy:{
                fuzziness:DOUBLE,
                maxExpensions:50
              }
            }
              sorting: {
                score: desc
              }
          ) {
              hits {
                  name
                  score
                  shortcuts
                  topics
                  defaultVariant {
                    sku
                    name
                    firstImage{
                      key
                      url
                    }
                    defaultPrice
                    defaultStock
                    stockLocations
                    
                  }
                  path
                  paginationToken
        
              }
            summary{
              totalHits
              hasMoreHits
              hasPreviousHits    
            }
          }
      }
  }
```

## VARIABLES:

The paginationToken will of course vary. We get this from the result 

```json
{
  "search_term": ".*hoytrykk.*",
  "paginationToken": "CLxUGgYQgICAiAgiJzolNjY4YmM1ZDQ3YTNjMTQ5ZjU1YjMyODMyLWVuLXB1Ymxpc2hlZA=="
}
```

## RESULT:
```json
{
  "data": {
    "browse": {
      "generiskProdukt": {
        "hits": [
          {
            "name": "AVA STÅLARMERT SKJØTESLANGE 20M",
            "score": 4,
            "shortcuts": [
              "/categories/bilpleie/hoytrykkspyler/hoytrykkspyler-ava/ava-stalarmert-skjoteslange-20m",
              "/categories/bilpleie/tilbehor/hoytrykkspyler/ava-stalarmert-skjoteslange-20m"
            ],
            "topics": {},
            "defaultVariant": {
              "sku": "AVA-11-120-403",
              "name": "AVA STÅLARMERT SKJØTESLANGE 20M",
              "firstImage": {
                "key": "bilxtra-prod/24/7/8/67/210795-ava-stalarmert-skjoteslange-20m-ava-11-120-403.jpeg",
                "url": "https://media.crystallize.com/bilxtra-prod/24/7/8/67/210795-ava-stalarmert-skjoteslange-20m-ava-11-120-403.jpeg"
              },
              "defaultPrice": 1279.2,
              "defaultStock": 36,
              "stockLocations": {
                "112": {
                  "stock": 2
                },
                "163": {
                  "stock": 1
                },
                "264": {
                  "stock": 1
                },
                "310": {
                  "stock": 1
                },
                "366": {
                  "stock": 5
                },
                "478": {
                  "stock": 0
                },
                "571": {
                  "stock": 2
                },
                "608": {
                  "stock": 0
                },
                "631": {
                  "stock": 2
                },
                "641": {
                  "stock": 1
                },
                "650": {
                  "stock": 2
                },
                "693": {
                  "stock": 2
                },
                "696": {
                  "stock": 1
                },
                "697": {
                  "stock": 3
                },
                "698": {
                  "stock": 2
                },
                "699": {
                  "stock": 1
                },
                "704": {
                  "stock": 2
                },
                "722": {
                  "stock": 2
                },
                "725": {
                  "stock": 1
                },
                "742": {
                  "stock": 1
                },
                "819": {
                  "stock": 2
                },
                "823": {
                  "stock": 1
                },
                "827": {
                  "stock": 1
                },
                "876": {
                  "stock": 1
                },
                "901": {
                  "stock": 2
                },
                "910": {
                  "stock": 1
                },
                "911": {
                  "stock": 2
                },
                "940": {
                  "stock": 1
                },
                "948": {
                  "stock": 1
                },
                "default": {
                  "stock": 36
                }
              }
            },
            "path": "/products/51062/ava-stalarmert-skjoteslange-20m",
            "paginationToken": "CMNUGgYQgICAiAgiJzolNjY4YmM1ZTU3YTNjMTQ5ZjU1YjMyODZhLWVuLXB1Ymxpc2hlZA=="
          },
          {
            "name": "AVA PREMIUM FOAM CANNON",
            "score": 4,
            "shortcuts": [
              "/categories/bilpleie/hoytrykkspyler/hoytrykkspyler-ava/ava-premium-foam-cannon",
              "/categories/bilpleie/tilbehor/hoytrykkspyler/ava-premium-foam-cannon"
            ],
            "topics": {},
            "defaultVariant": {
              "sku": "AVA-11-120-319",
              "name": "AVA PREMIUM FOAM CANNON",
              "firstImage": {
                "key": "bilxtra-prod/24/7/8/70/397563-ava-premium-foam-cannon-ava-11-120-319.jpeg",
                "url": "https://media.crystallize.com/bilxtra-prod/24/7/8/70/397563-ava-premium-foam-cannon-ava-11-120-319.jpeg"
              },
              "defaultPrice": 479.2,
              "defaultStock": 112,
              "stockLocations": {
                "109": {
                  "stock": 2
                },
                "112": {
                  "stock": 2
                },
                "163": {
                  "stock": 2
                },
                "264": {
                  "stock": 5
                },
                "301": {
                  "stock": 1
                },
                "310": {
                  "stock": 2
                },
                "366": {
                  "stock": 4
                },
                "571": {
                  "stock": 6
                },
                "641": {
                  "stock": 2
                },
                "696": {
                  "stock": 2
                },
                "697": {
                  "stock": 2
                },
                "698": {
                  "stock": 5
                },
                "722": {
                  "stock": 6
                },
                "725": {
                  "stock": 2
                },
                "742": {
                  "stock": 3
                },
                "895": {
                  "stock": 1
                },
                "996": {
                  "stock": 1
                },
                "default": {
                  "stock": 112
                }
              }
            },
            "path": "/products/51062/ava-premium-foam-cannon",
            "paginationToken": "CMVUGgYQgICAiAgiJzolNjY4YmM1ZWE3YTNjMTQ5ZjU1YjMyODdjLWVuLXB1Ymxpc2hlZA=="
          }
        ],
        "summary": {
          "totalHits": 100,
          "hasMoreHits": true,
          "hasPreviousHits": false
        }
      }
    }
  }
}
```