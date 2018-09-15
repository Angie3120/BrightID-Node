import random


def add_seed_groups(graph, num_seed_groups, min_ratio, max_ratio):
    seed_nodes = [node for node in graph.nodes if node.node_type == 'Seed']
    seed_groups = ['seed_group_{0}'.format(i) for i in range(num_seed_groups)]
    groups_dic = {}
    for node in seed_nodes:
        seed_group = random.choice(seed_groups)
        node.groups.add(seed_group)
        if seed_group not in groups_dic:
            groups_dic[seed_group] = []
        groups_dic[seed_group].append(node)
    for seed_node in seed_nodes:
        ratio = random.random()*(max_ratio - min_ratio) + min_ratio
        current_group = [group for group in seed_node.groups if group.startswith('seed_group_')][0]
        num_con = int(ratio * len(groups_dic[current_group]))
        pairs = [pair for pair in random.sample(groups_dic[current_group], num_con) if pair!=seed_node]
        edges = [(seed_node, pair) for pair in pairs]
        graph.add_edges_from(edges)


def increase_joint_nodes(graph, num_joint_node, min_ratio, max_ratio):
    non_sybils = [node for node in graph.nodes if node.node_type in ('Honest', 'Seed')]
    groups = set(sum([list(node.groups) for node in non_sybils], []))
    groups_dic = {}
    for group in groups:
        groups_dic[group] = [node for node in graph.nodes if group in node.groups]
    i = 0
    while i < num_joint_node:
        joint_node = random.choice(non_sybils)
        other_groups = groups - joint_node.groups
        if len(other_groups) == 0:
            continue
        i += 1
        random_group = random.choice(list(other_groups))
        joint_node.groups.add(random_group)
        ratio = random.random()*(max_ratio - min_ratio) + min_ratio
        num_con = int(ratio * len(groups_dic[random_group]))
        pairs = random.sample(groups_dic[random_group], num_con)
        edges = [(joint_node, pair) for pair in pairs]
        graph.add_edges_from(edges)



