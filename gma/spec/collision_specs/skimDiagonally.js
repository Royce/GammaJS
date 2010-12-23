{
    character : [[4, 13], [5, 12]],
    
    scenarios : [
        {
            individual: true,
            map       : [
                [[6, 13], [7, 12]],
                [[4, 15], [5, 14]]
            ],
            
            movement  : [1, 1],
            expected  : [1, 1]
        },
        
        {
            individual: true,
            map       : [
                [[1, 13.5], [2, 12.5]],
                [[3, 15.5], [4, 14.5]]
            ],
            
            movement  : [-4, 3],
            expected  : [-4, 3]
        }
    ]
}
