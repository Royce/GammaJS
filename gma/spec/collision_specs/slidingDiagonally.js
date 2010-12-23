{
    character : [[1, 11], [2, 12]],
    
    map       : [
        [[2, 11.5], [3, 13]],
        [[2, 10],   [3, 11.5]],
        [[2, 11],   [3, 13]],
        [[2, 10],   [3, 13]],
        [[2, 10],   [3, 12]]
    ],
    
    scenarios : [
        {
            individual: true,
            movement  : [2, 3],
            expected  : [0, 3]
        },
        
        {
            individual: true,
            movement  : [-2, 3],
            expected  : [-2, 3]
        }
    ]
}
