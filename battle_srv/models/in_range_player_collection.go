package models

import (
	"fmt"
	. "github.com/logrusorgru/aurora"
)

type InRangePlayerCollection struct {
	MaxSize            int                          `json:"-"`
	CurrentSize        int                          `json:"-"`
	CurrentNodePointer *InRangePlayerNode           `json:"-"`
	InRangePlayerMap   map[int32]*InRangePlayerNode `json:"-"`
}

func (p *InRangePlayerCollection) Init(maxSize int) *InRangePlayerCollection {
	p = &InRangePlayerCollection{
		MaxSize:            maxSize,
		CurrentSize:        0,
		CurrentNodePointer: nil,
		InRangePlayerMap:   make(map[int32]*InRangePlayerNode),
	}
	return p
}

func (p *InRangePlayerCollection) Print() {
	fmt.Println(Cyan(fmt.Sprintf("{ \n MaxSize: %d, \n CurrentSize: %d, \n }", p.MaxSize, p.CurrentSize)))
}

func (p *InRangePlayerCollection) AppendPlayer(player *Player) *InRangePlayerNode {
	if nil != p.InRangePlayerMap[player.Id] { //如果该玩家已存在返回nil
		return nil
	} else {
		//p.CurrentSize
		size := p.CurrentSize + 1
		if size > p.MaxSize { //超出守护塔的承载范围
			fmt.Println(Red(fmt.Sprintf("Error: InRangePlayerCollection overflow, MaxSize: %d, NowSize: %d", p.MaxSize, size)))
			return nil
		}
		p.CurrentSize = size

		node := InRangePlayerNode{
			Prev:   nil,
			Next:   nil,
			player: player,
		}

		p.InRangePlayerMap[player.Id] = &node

		{ //p.CurrentNodePointer
			if p.CurrentNodePointer == nil { //刚init好的情况
				p.CurrentNodePointer = &node
			} else { //加到最后面相当于循环链表prepend
				p.CurrentNodePointer.PrependNode(&node)
			}
		}

		return &node
	}
}

func (p *InRangePlayerCollection) RemovePlayerById(playerId int32) {
	nodePointer := p.InRangePlayerMap[playerId]

	delete(p.InRangePlayerMap, playerId)

	{ //p.CurrentNodePointer
		if p.CurrentNodePointer == nodePointer { //如果正准备攻击这个玩家,将指针移动到Next
			p.CurrentNodePointer = nodePointer.Next
		}
	}

	//Remove from the linked list
	nodePointer.RemoveFromLink()

	p.CurrentSize = p.CurrentSize - 1
}

func (p *InRangePlayerCollection) NextPlayerToAttack() *InRangePlayerNode {
	if p.CurrentNodePointer.Next != nil {
		p.CurrentNodePointer = p.CurrentNodePointer.Next
	} else {
		//继续攻击当前玩家
	}
	return p.CurrentNodePointer
}

//TODO: 完成重构

/// Doubly circular linked list Implement
type InRangePlayerNode struct {
	Prev   *InRangePlayerNode
	Next   *InRangePlayerNode
	player *Player
}

func (node *InRangePlayerNode) AppendNode(newNode *InRangePlayerNode) *InRangePlayerNode {
	if node == nil {
		return newNode
	} else if node.Next == nil && node.Prev == nil {
		node.Prev = newNode
		node.Next = newNode
		newNode.Prev = node
		newNode.Next = node
		return node
	} else {
		oldNext := node.Next
		node.Next = newNode
		newNode.Next = oldNext
		oldNext.Prev = newNode
		newNode.Prev = node
		return node
	}
}

func (node *InRangePlayerNode) PrependNode(newNode *InRangePlayerNode) *InRangePlayerNode {
	if node == nil { //没有节点的情况
		return newNode
	} else if node.Next == nil && node.Prev == nil { //单个节点的情况
		node.Prev = newNode
		node.Next = newNode
		newNode.Prev = node
		newNode.Next = node
		return node
	} else {
		oldPrev := node.Prev
		node.Prev = newNode
		newNode.Prev = oldPrev
		oldPrev.Next = newNode
		newNode.Next = node
		return node
	}
}

func (node *InRangePlayerNode) RemoveFromLink() {
	if node == nil {
		return
	} else if node.Next == nil && node.Prev == nil {
		node = nil //Wait for GC
	} else {
		prev := node.Prev
		next := node.Next
		prev.Next = next
		next.Prev = prev
		node = nil
	}
}

func (node *InRangePlayerNode) Print() {
	if node == nil {
		fmt.Println("No player in range")
	} else if node.Next == nil && node.Prev == nil {
		fmt.Println(Red(node.player.Id))
	} else {
		now := node.Next
		fmt.Printf("%d ", Red(node.player.Id))
		for node != now {
			fmt.Printf("%d ", Green(now.player.Id))
			now = now.Next
		}
		fmt.Println("")
	}
}

/// End Doubly circular linked list Implement
