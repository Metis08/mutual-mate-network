import { useEffect, useRef, useState } from 'react';
// @ts-ignore - react-force-graph doesn't have proper TS types
import ForceGraph2D from 'react-force-graph';

interface Node {
  id: string;
  name: string;
  color?: string;
  size?: number;
}

interface Link {
  source: string;
  target: string;
  color?: string;
  width?: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface TraversalStep {
  type: 'visit' | 'check' | 'found' | 'complete';
  nodeId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  message: string;
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
  const graphRef = useRef<any>();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());

  // Build initial graph data
  useEffect(() => {
    const nodes: Node[] = [];
    const links: Link[] = [];

    // Add current user
    const currentUser = allUsers.find(u => u.user_id === currentUserId);
    if (currentUser) {
      nodes.push({
        id: currentUserId,
        name: `${currentUser.name} (You)`,
        color: '#9b87f5',
        size: 12,
      });
    }

    // Add friends
    friends.forEach(friend => {
      nodes.push({
        id: friend.user_id,
        name: friend.name,
        color: '#7E69AB',
        size: 10,
      });
    });

    // Add friends of friends (not already friends)
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
        nodes.push({
          id: userId,
          name: user.name,
          color: '#D6BCFA',
          size: 8,
        });
      }
    });

    // Add links (friendships)
    friendships.forEach(fs => {
      const sourceInGraph = nodes.find(n => n.id === fs.user_id);
      const targetInGraph = nodes.find(n => n.id === fs.friend_id);
      if (sourceInGraph && targetInGraph) {
        links.push({
          source: fs.user_id,
          target: fs.friend_id,
          color: 'rgba(126, 105, 171, 0.3)',
          width: 1,
        });
      }
    });

    setGraphData({ nodes, links });
  }, [currentUserId, friends, allUsers, friendships]);

  // Animate BFS traversal
  useEffect(() => {
    if (!isAnimating) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    let animationTimeout: NodeJS.Timeout;
    const animate = async () => {
      const highlighted = new Set<string>();
      const highlightedLinks = new Set<string>();

      // Highlight current user
      highlighted.add(currentUserId);
      setHighlightNodes(new Set(highlighted));
      await new Promise(resolve => setTimeout(resolve, 800));

      // For each friend
      for (const friend of friends) {
        // Highlight connection to friend
        highlightedLinks.add(`${currentUserId}-${friend.user_id}`);
        highlightedLinks.add(`${friend.user_id}-${currentUserId}`);
        highlighted.add(friend.user_id);
        setHighlightNodes(new Set(highlighted));
        setHighlightLinks(new Set(highlightedLinks));
        await new Promise(resolve => setTimeout(resolve, 600));

        // Find friend's friends
        const friendConnections = friendships.filter(
          fs => fs.user_id === friend.user_id || fs.friend_id === friend.user_id
        );

        for (const conn of friendConnections) {
          const potentialFriendId = conn.user_id === friend.user_id ? conn.friend_id : conn.user_id;
          
          if (potentialFriendId !== currentUserId && !friends.some(f => f.user_id === potentialFriendId)) {
            // Highlight this potential connection
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

    return () => {
      if (animationTimeout) clearTimeout(animationTimeout);
    };
  }, [isAnimating, currentUserId, friends, friendships]);

  return (
    <div className="w-full h-[600px] glass-card rounded-lg overflow-hidden border border-primary/20">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeLabel="name"
        nodeAutoColorBy="color"
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          
          // Node circle
          const isHighlighted = highlightNodes.has(node.id);
          const radius = node.size || 5;
          
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = isHighlighted ? '#F97316' : node.color || '#999';
          ctx.fill();
          
          if (isHighlighted) {
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
            
            // Glow effect
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#F97316';
          }
          
          // Label
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isHighlighted ? '#FFF' : 'rgba(255, 255, 255, 0.8)';
          ctx.fillText(label, node.x, node.y + radius + fontSize);
        }}
        linkCanvasObject={(link: any, ctx, globalScale) => {
          const linkKey1 = `${link.source.id}-${link.target.id}`;
          const linkKey2 = `${link.target.id}-${link.source.id}`;
          const isHighlighted = highlightLinks.has(linkKey1) || highlightLinks.has(linkKey2);
          
          ctx.beginPath();
          ctx.moveTo(link.source.x, link.source.y);
          ctx.lineTo(link.target.x, link.target.y);
          ctx.strokeStyle = isHighlighted ? '#F97316' : link.color || 'rgba(126, 105, 171, 0.3)';
          ctx.lineWidth = isHighlighted ? 3 / globalScale : (link.width || 1) / globalScale;
          
          if (isHighlighted) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#F97316';
          }
          
          ctx.stroke();
        }}
        backgroundColor="#0a0a0a"
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={(link: any) => {
          const linkKey1 = `${link.source.id}-${link.target.id}`;
          const linkKey2 = `${link.target.id}-${link.source.id}`;
          return highlightLinks.has(linkKey1) || highlightLinks.has(linkKey2) ? 4 : 0;
        }}
        linkDirectionalParticleColor={() => '#F97316'}
        linkDirectionalParticleSpeed={0.005}
        cooldownTicks={100}
        warmupTicks={50}
        d3VelocityDecay={0.3}
      />
    </div>
  );
};
