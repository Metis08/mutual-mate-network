import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-force';

interface Node {
  id: string;
  name: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  color: string;
  size: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

interface GraphVisualizationProps {
  currentUserId: string;
  friends: Array<{ user_id: string; name: string }>;
  allUsers: Array<{ user_id: string; name: string }>;
  friendships: Array<{ user_id: string; friend_id: string }>;
  isAnimating: boolean;
}

export const GraphVisualization = ({
  currentUserId,
  friends,
  allUsers,
  friendships,
  isAnimating,
}: GraphVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const animationRef = useRef<number>();

  // Build graph data
  useEffect(() => {
    const nodeList: Node[] = [];
    const linkList: Link[] = [];

    // Add current user
    const currentUser = allUsers.find(u => u.user_id === currentUserId);
    if (currentUser) {
      nodeList.push({
        id: currentUserId,
        name: `${currentUser.name} (You)`,
        color: '#9b87f5',
        size: 16,
      });
    }

    // Add friends
    friends.forEach(friend => {
      nodeList.push({
        id: friend.user_id,
        name: friend.name,
        color: '#7E69AB',
        size: 12,
      });
    });

    // Add friends of friends
    const friendIds = friends.map(f => f.user_id);
    const friendsOfFriends = new Set<string>();

    friendships.forEach(fs => {
      if (friendIds.includes(fs.user_id) && fs.friend_id !== currentUserId && !friendIds.includes(fs.friend_id)) {
        friendsOfFriends.add(fs.friend_id);
      }
      if (friendIds.includes(fs.friend_id) && fs.user_id !== currentUserId && !friendIds.includes(fs.user_id)) {
        friendsOfFriends.add(fs.user_id);
      }
    });

    friendsOfFriends.forEach(userId => {
      const user = allUsers.find(u => u.user_id === userId);
      if (user) {
        nodeList.push({
          id: userId,
          name: user.name,
          color: '#D6BCFA',
          size: 10,
        });
      }
    });

    // Add links
    friendships.forEach(fs => {
      const sourceInGraph = nodeList.find(n => n.id === fs.user_id);
      const targetInGraph = nodeList.find(n => n.id === fs.friend_id);
      if (sourceInGraph && targetInGraph) {
        linkList.push({
          source: fs.user_id,
          target: fs.friend_id,
        });
      }
    });

    setNodes(nodeList);
    setLinks(linkList);
  }, [currentUserId, friends, allUsers, friendships]);

  // Animate BFS traversal
  useEffect(() => {
    if (!isAnimating) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const animate = async () => {
      const highlighted = new Set<string>();
      const highlightedLinks = new Set<string>();

      // Highlight current user
      highlighted.add(currentUserId);
      setHighlightNodes(new Set(highlighted));
      await new Promise(resolve => setTimeout(resolve, 800));

      // For each friend
      for (const friend of friends) {
        highlightedLinks.add(`${currentUserId}-${friend.user_id}`);
        highlightedLinks.add(`${friend.user_id}-${currentUserId}`);
        highlighted.add(friend.user_id);
        setHighlightNodes(new Set(highlighted));
        setHighlightLinks(new Set(highlightedLinks));
        await new Promise(resolve => setTimeout(resolve, 600));

        const friendConnections = friendships.filter(
          fs => fs.user_id === friend.user_id || fs.friend_id === friend.user_id
        );

        for (const conn of friendConnections) {
          const potentialFriendId = conn.user_id === friend.user_id ? conn.friend_id : conn.user_id;
          
          if (potentialFriendId !== currentUserId && !friends.some(f => f.user_id === potentialFriendId)) {
            highlightedLinks.add(`${friend.user_id}-${potentialFriendId}`);
            highlightedLinks.add(`${potentialFriendId}-${friend.user_id}`);
            highlighted.add(potentialFriendId);
            setHighlightNodes(new Set(highlighted));
            setHighlightLinks(new Set(highlightedLinks));
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    animate();
  }, [isAnimating, currentUserId, friends, friendships]);

  // D3 force simulation and canvas rendering
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const render = () => {
      context.clearRect(0, 0, width, height);
      context.save();

      // Draw links
      context.strokeStyle = 'rgba(126, 105, 171, 0.3)';
      context.lineWidth = 1;
      links.forEach((link: any) => {
        const linkKey1 = `${link.source.id}-${link.target.id}`;
        const linkKey2 = `${link.target.id}-${link.source.id}`;
        const isHighlighted = highlightLinks.has(linkKey1) || highlightLinks.has(linkKey2);

        context.beginPath();
        context.moveTo(link.source.x, link.source.y);
        context.lineTo(link.target.x, link.target.y);
        context.strokeStyle = isHighlighted ? '#F97316' : 'rgba(126, 105, 171, 0.3)';
        context.lineWidth = isHighlighted ? 3 : 1;
        
        if (isHighlighted) {
          context.shadowBlur = 15;
          context.shadowColor = '#F97316';
        } else {
          context.shadowBlur = 0;
        }
        
        context.stroke();
      });

      // Draw nodes
      nodes.forEach((node: any) => {
        const isHighlighted = highlightNodes.has(node.id);
        
        context.beginPath();
        context.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
        context.fillStyle = isHighlighted ? '#F97316' : node.color;
        
        if (isHighlighted) {
          context.shadowBlur = 20;
          context.shadowColor = '#F97316';
        } else {
          context.shadowBlur = 0;
        }
        
        context.fill();
        
        if (isHighlighted) {
          context.strokeStyle = '#FFF';
          context.lineWidth = 3;
          context.stroke();
        }

        // Draw label
        context.shadowBlur = 0;
        context.fillStyle = isHighlighted ? '#FFF' : 'rgba(255, 255, 255, 0.9)';
        context.font = '12px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'top';
        context.fillText(node.name, node.x, node.y + node.size + 5);
      });

      context.restore();
    };

    simulation.on('tick', () => {
      render();
    });

    // Mouse drag interaction
    let dragNode: Node | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      dragNode = nodes.find((node: any) => {
        const dx = x - node.x;
        const dy = y - node.y;
        return Math.sqrt(dx * dx + dy * dy) < node.size;
      }) || null;

      if (dragNode) {
        simulation.alphaTarget(0.3).restart();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragNode) {
        const rect = canvas.getBoundingClientRect();
        (dragNode as any).fx = e.clientX - rect.left;
        (dragNode as any).fy = e.clientY - rect.top;
      }
    };

    const handleMouseUp = () => {
      if (dragNode) {
        (dragNode as any).fx = null;
        (dragNode as any).fy = null;
        dragNode = null;
        simulation.alphaTarget(0);
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      simulation.stop();
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [nodes, links, highlightNodes, highlightLinks]);

  return (
    <div className="w-full h-[600px] glass-card rounded-lg overflow-hidden border border-primary/20 bg-[#0a0a0a]">
      <canvas
        ref={canvasRef}
        width={1200}
        height={600}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
