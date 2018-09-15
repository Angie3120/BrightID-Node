# Using real social network graphs from networkrepository.com
# ./inputs/socfb-Auburn71.mtx has 18K nodes and 974K edges
# ./inputs/soc-hamsterster.edges has 2K nodes and 17K edges

import algorithms
import graphs
import os
from utils import *


OUTPUT_FOLDER = './outputs/tests4/'

print('Please wait, graph is loading ...')
graph = graphs.generators.networkrepository.generate({

    'file_path': os.path.abspath('./inputs/soc-hamsterster.edges'),
    'num_seed_to_num_honest': .15,
    'num_attacker_to_num_honest': .01,
    'num_sybil_to_num_attacker': 1,
    'sybil_to_attackers_con': .01
})
print('Graph loading completed, Calculating ranks ...')
algorithms.SybilRank(graph, {
    'min_degree': 8,
    'accumulative': False,
    'weaken_under_min': False,
    'nonlinear_distribution': False,
}).rank()
output1 = generate_output(graph)
draw_graph(graph, os.path.join(OUTPUT_FOLDER, '1.html'))

reset_ranks(graph)

algorithms.SybilRank(graph, {
    'min_degree': 8,
    'accumulative': False,
    'weaken_under_min': False,
    'nonlinear_distribution': True,
}).rank()
output2 = generate_output(graph)
draw_graph(graph, os.path.join(OUTPUT_FOLDER, '2.html'))

reset_ranks(graph)

algorithms.SybilRank(graph, {
    'min_degree': 8,
    'accumulative': False,
    'weaken_under_min': True,
    'nonlinear_distribution': False,
}).rank()
output3 = generate_output(graph)
draw_graph(graph, os.path.join(OUTPUT_FOLDER, '3.html'))

reset_ranks(graph)

algorithms.SybilRank(graph, {
    'min_degree': 8,
    'accumulative': False,
    'weaken_under_min': True,
    'nonlinear_distribution': True,
}).rank()
output4 = generate_output(graph)
draw_graph(graph, os.path.join(OUTPUT_FOLDER, '4.html'))

reset_ranks(graph)
graphs.modifiers.nodes.add_sybil_to_attacker_con(graph, 7)

algorithms.SybilRank(graph, {
    'min_degree': 8,
    'accumulative': False,
    'weaken_under_min': True,
    'nonlinear_distribution': True,
}).rank()
output5 = generate_output(graph)
draw_graph(graph, os.path.join(OUTPUT_FOLDER, '5.html'))

reset_ranks(graph)
graphs.modifiers.nodes.remove_weak_attackers(graph, .7)

algorithms.SybilRank(graph, {
    'min_degree': 8,
    'accumulative': False,
    'weaken_under_min': True,
    'nonlinear_distribution': True,
}).rank()
output6 = generate_output(graph)
draw_graph(graph, os.path.join(OUTPUT_FOLDER, '6.html'))


print('Finished')
write_output_file([output1, output2, output3, output4, output5, output6], os.path.join(OUTPUT_FOLDER, 'result.csv'))
