{
    map : [
        [[2,   17], [3,   16]],
        [[3,   17], [4,   16]],
        [[4,   17], [5,   16]],
        [[5,   17], [6,   16]],
        [[3.5, 15], [4.5, 14]],
        [[3,   13], [6,   12]],
        [[2,   11], [4,   10]]
    ],
    
    scenarios : [
        {
            individual: true,
            mapUse    : [1, 2, 3, 4, 5],
            
            character : [[3, 16], [4, 15]],
            movement  : [4, 0],
            expected  : [4, 0],
        },
        
        {
            individual: true,
            mapUse    : [5, 6],

            character : [[4, 14], [5, 13]],
            movement  : [3, 0],
            expected  : [3, 0],
        },
        
        {
            individual: true,
            mapUse    : [6, 7],

            character : [[3, 12], [4, 11]],
            movement  : [4, 0],
            expected  : [4, 0],
        }
    ]
}
