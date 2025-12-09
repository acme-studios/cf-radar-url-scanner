import { useEffect, useState } from 'react'

interface ConfettiPiece {
  id: number
  x: number
  y: number
  rotation: number
  color: string
  size: number
  velocity: { x: number; y: number }
}

export function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    // Generate confetti pieces
    const colors = ['#F6821F', '#FF9A3C', '#E5751A', '#FFD700', '#FF6B6B', '#4ECDC4']
    const newPieces: ConfettiPiece[] = []

    for (let i = 0; i < 50; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -20,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 5,
        velocity: {
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * 3 + 2
        }
      })
    }

    setPieces(newPieces)

    // Animate confetti
    let animationFrame: number
    const animate = () => {
      setPieces(prev =>
        prev.map(piece => ({
          ...piece,
          x: piece.x + piece.velocity.x,
          y: piece.y + piece.velocity.y,
          rotation: piece.rotation + 5,
          velocity: {
            x: piece.velocity.x * 0.99,
            y: piece.velocity.y + 0.1 // gravity
          }
        })).filter(piece => piece.y < window.innerHeight + 50)
      )

      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    // Clean up after 4 seconds
    const timeout = setTimeout(() => {
      cancelAnimationFrame(animationFrame)
      setPieces([])
    }, 4000)

    return () => {
      cancelAnimationFrame(animationFrame)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: `${piece.x}px`,
            top: `${piece.y}px`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            opacity: 0.8
          }}
        />
      ))}
    </div>
  )
}
